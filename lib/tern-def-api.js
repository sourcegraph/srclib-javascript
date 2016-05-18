var tern = require('tern');
var infer = require('tern/lib/infer');

var logger = require('./logger.js');

module.exports.findDef = function(srv, query, file) {
  try {
    return findDefInternal(srv, query, file);
  } catch (e) {
    logger.warn("An error occurred while querying tern usind query", query.type, ":", e);
    return null;
  }
}

function findDefInternal(srv, query, file) {
  var expr = tern.findQueryExpr(file, query);
  var type = findExprType(srv, query, file, expr);
  //if (infer.didGuess()) return {};

  var span = tern.getSpan(type);
  var result = {
    url: type.url,
    doc: parseDoc(query, type.doc),
    origin: type.origin
  };

  if (type.types)
    for (var i = type.types.length - 1; i >= 0; --i) {
      var tp = type.types[i];
      storeTypeDocs(query, tp, result);
      if (!span) span = tern.getSpan(tp);
    }

  if (span && span.node) { // refers to a loaded file
    var spanFile = span.node.sourceFile || srv.fileMap[span.origin];
    var start = tern.outputPos(query, spanFile, span.node.start),
      end = tern.outputPos(query, spanFile, span.node.end);
    result.start = start;
    result.end = end;
    result.file = span.origin;
    var cxStart = Math.max(0, span.node.start - 50);
    result.contextOffset = span.node.start - cxStart;
    result.context = spanFile.text.slice(cxStart, cxStart + 50);
  } else if (span) { // external
    result.file = span.origin;
    tern.storeSpan(srv, query, span, result);
  }
  return clean(result);
}

function clean(obj) {
  for (var prop in obj)
    if (obj[prop] == null) delete obj[prop];
  return obj;
}

function parseDoc(query, doc) {
  if (!doc) return null;
  if (query.docFormat == "full") return doc;
  var parabreak = /.\n[\s@\n]/.exec(doc);
  if (parabreak) doc = doc.slice(0, parabreak.index + 1);
  doc = doc.replace(/\n\s*/g, " ");
  if (doc.length < 100) return doc;
  var sentenceEnd = /[\.!?] [A-Z]/g;
  sentenceEnd.lastIndex = 80;
  var found = sentenceEnd.exec(doc);
  if (found) doc = doc.slice(0, found.index + 1);
  return doc;
}

function storeTypeDocs(query, type, out) {
  if (!out.url) out.url = type.url;
  if (!out.doc) out.doc = parseDoc(query, type.doc);
  if (!out.origin) out.origin = type.origin;
  var ctor, boring = infer.cx().protos;
  if (!out.url && !out.doc && type.proto && (ctor = type.proto.hasCtor) &&
    type.proto != boring.Object && type.proto != boring.Function && type.proto != boring.Array) {
    out.url = ctor.url;
    out.doc = parseDoc(query, ctor.doc);
  }
}

function findExprType(srv, query, file, expr) {
  var type;
  if (expr) {
    infer.resetGuessing();
    type = infer.expressionType(expr);
  }
  var typeHandlers = srv.hasHandler("typeAt")
  if (typeHandlers) {
    var pos = tern.resolvePos(file, query.end)
    for (var i = 0; i < typeHandlers.length; i++)
      type = typeHandlers[i](file, pos, expr, type)
  }
  if (!type) throw "No type found at the given position.";

  var objProp;
  if (expr.node.type == "ObjectExpression" && query.end != null &&
    (objProp = pointInProp(expr.node, tern.resolvePos(file, query.end)))) {
    var name = objProp.key.name;
    var fromCx = ensureObj(infer.typeFromContext(file.ast, expr));
    if (fromCx && fromCx.hasProp(name)) {
      type = fromCx.hasProp(name);
    } else {
      var fromLocal = ensureObj(type);
      if (fromLocal && fromLocal.hasProp(name))
        type = fromLocal.hasProp(name);
    }
  }
  return type;
};

function pointInProp(objNode, point) {
  for (var i = 0; i < objNode.properties.length; i++) {
    var curProp = objNode.properties[i];
    if (curProp.key.start <= point && curProp.key.end >= point)
      return curProp;
  }
}

function ensureObj(tp) {
  if (!tp || !(tp = tp.getType()) || !(tp instanceof infer.Obj)) return null;
  return tp;
}
