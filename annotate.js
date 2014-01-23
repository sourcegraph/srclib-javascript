var idents = require('javascript-idents');
var infer = require('tern/lib/infer');
var nodejs_util = require('./nodejs_util');
var tern = require('tern');
var symbol_id = require('./symbol_id');

exports.refs = function(origins, options) {
  if (typeof origins == 'string') origins = [origins];
  var state = new State(origins, options || {});

  state.cx.parent.files.forEach(function(file) {
    if (!state.isTarget(file.name)) return;
    idents.inspect(file.ast, function(ident) {
      resolve(file, ident, state);
    });
  });

  return state.output;
};

function State(origins, options) {
  this.origins = origins;
  this.cx = infer.cx();
  this.output = [];
}

State.prototype.isTarget = function(origin) {
  return this.origins.indexOf(origin) > -1;
};

function resolve(file, ident, state) {
  var out = {file: file.name, span: ident.start + '-' + ident.end};

  out.target = getRefTarget(file, ident);
  if (out.target) {
    if (state.isTarget(out.target.origin)) delete out.target.origin;
  }

  if (out.target) state.output.push(out);
}

function getRefTarget(file, ident) {
  if (ident._path) return getConcretePathTypeID(ident._path);

  var expr;
  try {
    expr = tern.findQueryExpr(file, ident);
  } catch (e) {
    console.error('No expression at ' + file.name + ':' + ident.start + '-' + ident.end);
    return null;
  }

  var av = infer.expressionType(expr);
  if (av.originNode && av.originNode._path) return getConcretePathTypeID(av.originNode._path);

  var type = av.getType(false);
  if (!type) return null;
  if (type.originNode && type.originNode._path) return getConcretePathTypeID(type.originNode._path);

  if (type instanceof infer.Prim || type instanceof infer.Arr) return;

  return getTypeID(type);
}

function getConcretePathTypeID(path) {
  var target = symbol_id.parse(path);
  target.abstract = false;

  if (target.namespace == 'commonjs') {
    nodejs_util.addPackageInfo(target);
  }

  return target;
}

function getTypeID(type) {
  // Hack for CommonJS "module"
  if (type.name == 'Module' && type.proto.origin == 'node' && type.proto.name == 'Module.prototype') {
    type.origin = 'node';
    type._isCommonJSModule = true;
  }

  if (type.path && type.path.indexOf('!node') == 0 && type.origin == 'node') {
    type.path = type.name;
  }

  var target = {origin: type.origin};
  switch (type.origin) {
  case 'ecma5':
  case 'browser':
    target.abstract = true;
    // Using the type name is usually what we want, but it may over-resolve.
    // Uncomment this line below to see where it's resolving.
    //
    // if (type.path != type.name) console.error('type.path != type.name:   ', type.path, '!=', type.name);
    target.path = type.name;
    target.namespace = 'global';
    break;
  case 'node':
    target.abstract = true;

    // Hack for CommonJS "module"
    if (type._isCommonJSModule) {
      target.module = 'module';
      target.namespace = 'global';
      break;
    }

    // Hack for CommonJS "require"
    if (type.name == 'require') {
      type.path = type.name = 'module.prototype.require';
    } else if (type.name.indexOf('require.') == 0) {
      type.path = type.name = type.name.replace(/^require\./, 'module.prototype.require.');
    }

    if (type.name.indexOf('console.') == 0) {
      type.path = type.name = type.name.replace(/^console\./, 'console.Console.prototype.');
    }

    if (!type.path) type.path = type.name;
    var parts = type.path.split('.');
    target.namespace = 'commonjs';
    target.module = parts[0];
    target.path = parts.slice(1).join('.');
    break;
  case 'requirejs':
    target.abstract = true;
    target.path = type.path;
    target.namespace = 'global';
    target.module = '';
    break;
  default:
    target.abstract = false;

    // Hack for CommonJS module obtained via "require"
    if (type.metaData && type.metaData.nodejs && type.metaData.nodejs.moduleExports) {
      type.path = '!commonjs.' + type.origin.replace(/\./g, '`');
    }

    // Hack for RequireJS module definition
    if (type.metaData && type.metaData.amd && type.metaData.amd.module) {
      type.path = '!requirejs.' + type.origin.replace(/\./g, '`');
    }

    if (!type.path) {
      // Type is probably a local variable or some other type that's unreachable
      // from the topScope or roots.
      // throw new Error('no type.path: ' + require('util').inspect(type));
      return;
    }
    return getConcretePathTypeID(type.path);
  }

  return target;
}
