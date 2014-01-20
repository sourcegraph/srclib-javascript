var idents = require('javascript-idents');
var infer = require('tern/lib/infer');
var tern = require('tern');

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

  if (out.target && out.target.path) state.output.push(out);
}

function getRefTarget(file, ident) {
  if (ident._path) return {path: ident._path};

  var expr;
  try {
    expr = tern.findQueryExpr(file, ident);
  } catch (e) {
    console.error('No expression at ' + file.name + ':' + ident.start + '-' + ident.end);
    return null;
  }

  var av = infer.expressionType(expr);
  if (av.originNode && av.originNode._path) return {path: av.originNode._path};

  var type = av.getType(false);
  if (!type) return null;
  if (type.originNode && type.originNode._path) return {path: type.originNode._path};

  return {path: type.path, origin: type.origin};
}
