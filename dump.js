var defnode = require('defnode');
var infer = require('tern/lib/infer');

exports.dump = function(origins, options) {
  if (typeof origins == 'string') origins = [origins];
  var state = new State(origins, options || {});

  runPass(state.passes.preDumpReach, state);
  runPass(state.passes.preCondenseReach, state);

  state.cx.topScope.path = "<top>";
  state.cx.topScope.reached("", state);
  for (var path in state.roots)
    reach(state.roots[path], null, path, state);
  for (var i = 0; i < state.patchUp.length; ++i)
    patchUpSimpleInstance(state.patchUp[i], state);

  runPass(state.passes.postDumpReach, state);

  for (var path in state.types)
    store(path, state.types[path], state);
  for (var path in state.altPaths)
    storeAlt(path, state.altPaths[path], state);
  var hasDef = false;
  for (var _def in state.output['!define']) { hasDef = true; break; }
  if (!hasDef) delete state.output['!define'];

  runPass(state.passes.postDump, state);

  return state.output;
};

function State(origins, options) {
  this.origins = origins;
  this.cx = infer.cx();
  this.passes = options.passes || this.cx.parent && this.cx.parent.passes || {};
  this.maxOrigin = -Infinity;
  for (var i = 0; i < origins.length; ++i)
    this.maxOrigin = Math.max(this.maxOrigin, this.cx.origins.indexOf(origins[i]));
  this.output = [];
  this.options = options;
  this.types = Object.create(null);
  this.altPaths = Object.create(null);
  this.patchUp = [];
  this.roots = Object.create(null);
}

State.prototype.isTarget = function(origin) {
  return this.origins.indexOf(origin) > -1;
};

State.prototype.getSpan = function(node) {
  if (this.options.spans == false) return null;
  if (node.span) return node.span;
  if (!node.originNode) return null;
  return node.originNode.start + '-' + node.originNode.end;
};

function pathLen(path) {
  var len = 1, pos = 0, dot;
  while ((dot = path.indexOf('.', pos)) != -1) {
    pos = dot + 1;
    len += path.charAt(pos) == '!' ? 10 : 1;
  }
  return len;
}

function isConcrete(path) {
  return !/\!|<i>/.test(path);
}

function hop(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function isSimpleInstance(o) {
  return o.proto && !(o instanceof infer.Fn) && o.proto != infer.cx().protos.Object &&
    o.proto.hasCtor && !o.hasCtor;
}

function reach(type, path, id, state) {
  var actual = type.getType(false);
  if (!actual) return;
  var orig = type.origin || actual.origin, relevant = false;
  if (orig) {
    var origPos = state.cx.origins.indexOf(orig);
    // This is a path that is newer than the code we are interested in.
    if (origPos > state.maxOrigin) return;
    relevant = state.isTarget(orig);
  }
  var newPath = path ? path + '.' + id : id, oldPath = actual.path;
  var shorter = !oldPath || pathLen(oldPath) > pathLen(newPath);
  if (shorter) {
    if (!(actual instanceof infer.Prim)) actual.path = newPath;
    if (actual.reached(newPath, state, !relevant) && relevant) {
      var data = state.types[oldPath];
      if (data) {
        delete state.types[oldPath];
        state.altPaths[oldPath] = actual;
      } else data = {type: actual};
      data.object = type;
      data.doc = type.doc || (actual != type && state.isTarget(actual.origin) && type.doc) || data.doc;
      data.data = actual.metaData;
      state.types[newPath] = data;
    }
  } else {
    if (relevant) {
      state.altPaths[newPath] = actual;
    }
  }
}
function reachTypeOnly(aval, path, id, state) {
  var type = aval.getType();
  if (type) reach(type, path, id, state);
}

infer.Prim.prototype.reached = function() {return true;};

infer.Arr.prototype.reached = function(path, state, concrete) {
  if (!concrete) reachTypeOnly(this.getProp('<i>'), path, '<i>', state);
  return true;
};

infer.Fn.prototype.reached = function(path, state, concrete) {
  infer.Obj.prototype.reached.call(this, path, state, concrete);
  if (!concrete) {
    for (var i = 0; i < this.args.length; ++i)
      reachTypeOnly(this.args[i], path, '!' + i, state);
    reachTypeOnly(this.retval, path, '!ret', state);
  }
  return true;
};

infer.Obj.prototype.reached = function(path, state, concrete) {
  if (isSimpleInstance(this) && !this.dumpForceInclude) {
    if (state.patchUp.indexOf(this) == -1) state.patchUp.push(this);
    return true;
  } else if (this.proto && !concrete) {
    reach(this.proto, path, '!proto', state);
  }
  var hasProps = false;
  for (var prop in this.props) {
    reach(this.props[prop], path, prop, state);
    hasProps = true;
  }
  if (!hasProps && !this.dumpForceInclude && !(this instanceof infer.Fn)) {
    this.nameOverride = '?';
    return false;
  }
  return true;
};

function patchUpSimpleInstance(obj, state) {
  var path = obj.proto.hasCtor.path;
  if (path) {
    obj.nameOverride = '+' + path;
  } else {
    path = obj.path;
  }
  for (var prop in obj.props)
    reach(obj.props[prop], path, prop, state);
}

function createPath(parts, state) {
  var base = state.output;
  for (var i = parts.length - 1; i >= 0; --i) if (!isConcrete(parts[i])) {
    var def = parts.slice(0, i + 1).join('.');
    var defs = state.output['!define'];
    if (hop(defs, def)) base = defs[def];
    else defs[def] = base = {};
    parts = parts.slice(i + 1);
  }
  for (var i = 0; i < parts.length; ++i) {
    if (hop(base, parts[i])) base = base[parts[i]];
    else base = base[parts[i]] = {};
  }
  return base;
}

function store(path, info, state) {
  var out = {path: path};
  var name = typeName(info.type);
  if (name != info.type.path && name != '?') {
    out['!type'] = name;
  } else if (info.type.proto && info.type.proto != state.cx.protos.Object) {
    var protoName = typeName(info.type.proto);
    if (protoName != '?') out['!proto'] = protoName;
  }
  if (info.file) out['!file'] = info.file;
  if (info.type) out['!typeDef'] = {file: info.type.origin, span: state.getSpan(info.type)};
  if (info.object) {
    out['!objectDef'] = {file: info.object.origin, identSpan: state.getSpan(info.object)};
    if (info.object.originNode) {
      try {
        var defNode = defnode.findDefinitionNode(info.object.originNode.sourceFile.ast, info.object.originNode.start, info.object.originNode.end);
        if (defNode) {
          var bodySpan = state.getSpan({originNode: defNode});
          if (bodySpan) out['!objectDef'].bodySpan = bodySpan;
        }
      } catch(e) {}
    }
  }
  if (info.objectDef) out['!objectDef'] = info.objectDef;
  if (info.doc) out['!doc'] = info.doc;
  if (info.data) out['!data'] = info.data;
  state.output.push(out);
}

// TODO(sqs): make this emit refs and locals

function storeAlt(path, type, state) {
  state.output[path] = type.nameOverride || type.path;
}

var typeNameStack = [];
function typeName(type) {
  var actual = type.getType(false);
  if (!actual || typeNameStack.indexOf(actual) > -1)
    return actual && actual.path || '?';
  typeNameStack.push(actual);
  var name = actual.typeName();
  typeNameStack.pop();
  return name;
}

infer.Prim.prototype.typeName = function() { return this.name; };

infer.Arr.prototype.typeName = function() {
  return '[' + typeName(this.getProp('<i>')) + ']';
};

infer.Fn.prototype.typeName = function() {
  var out = 'fn(';
  for (var i = 0; i < this.args.length; ++i) {
    if (i) out += ', ';
    var name = this.argNames[i];
    if (name && name != '?') out += name + ': ';
    out += typeName(this.args[i]);
  }
  out += ')';
  if (this.computeRetSource) {
    out += ' -> ' + this.computeRetSource;
  } else if (!this.retval.isEmpty()) {
    var rettype = this.retval.getType(false);
    if (rettype) out += ' -> ' + typeName(rettype);
  }
  return out;
};

infer.Obj.prototype.typeName = function() {
  if (this.nameOverride) return this.nameOverride;
  if (!this.path) return '?';
  return this.path;
};

function runPass(functions) {
  if (functions) for (var i = 0; i < functions.length; ++i)
    functions[i].apply(null, Array.prototype.slice.call(arguments, 1));
}
