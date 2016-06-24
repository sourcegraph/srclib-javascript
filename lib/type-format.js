//XRegExp lib provided functions for search and work with nested regexp
var XRegExp = require('xregexp');
var logger = require('./logger.js');

/**
 * Main function for type formatting, replaces functions and objects,
 * simplifies complicated types
*/
module.exports.formatType = function(type, nodeInfo) {
  if (nodeInfo.kind === "function") {
    return {kind: "function", type: nodeInfo.typeInfo};
  }

  var allTypes = simplifyFunctions(simplifyObjects(type)).split("|");
  var uniqModTypes = [];
  //simplifies the same complex types,e.g. Object | Object is transformed into Object
  for (var i = 0; i < allTypes.length; i++) {
    // delete return type in function signature
    var simpleType = allTypes[i];
    if (simpleType.indexOf("->") !== -1) {
      simpleType = simpleType.substring(0, simpleType.indexOf("->"));
    }
    if (uniqModTypes.indexOf(simpleType) === -1) {
      uniqModTypes.push(simpleType);
    }
  }

  var resType = uniqModTypes.join("|");

  //detects that type of var or property is function type
  return (resType.startsWith("(")) ? {kind: "function", type: resType} : {kind: "", type : resType};
}

/**
 * Simplifies object types, replaces object signature with Objecy type
*/
function simplifyObjects(type) {
  var res = XRegExp.matchRecursive(type, "{", "}", 'g');
  var resType = type;
  for (var i = 0; i < res.length; i++) {
    resType = resType.replace("{" + res[i] + "}", "Object");
  }
  return resType;
}

/**
 * Simplifies function types, deletes types of parameters
 */
function simplifyFunctions(type) {
  type = type.replace("fn*(", "fn(");
  /**
   * Removes nested function type signatures
   * Function type fn(param1: type1, param2: type2) -> type is transformed into (param1, param2) -> type
   */
  function removeParameterFn(type) {
    var res = XRegExp.matchRecursive(type, "fn\\(", "\\)", 'g');
    var resType = type;
    for (var i = 0; i < res.length; i++) {
      resType = resType.replace("fn(" + res[i] + ")", "function");
    }
    return resType;
  }

  // returns all occurences of functions, takes into account nested functions
  try {
    var res = XRegExp.matchRecursive(type, "fn\\(", "\\)", 'g');
    var resType = type;

    for (var i = 0; i < res.length; i++) {
      //removes nested functions
      var fnSig = removeParameterFn(res[i]);
      var paramsRes = fnSig.split(",");
      var paramNames = [];
      //removes types of parameters
      for (var j = 0; j < paramsRes.length; j++) {
        var param = paramsRes[j];
        paramNames.push(param.split(":")[0]);
      }
      var newFnSig = paramNames.join(", ");
      resType = resType.replace("fn(" + res[i] + ")", "(" + newFnSig + ")");
    }

    return resType;
  } catch (exc) {
    logger.error("Error with Xregexp match for type = ", type, ", Exception = ", exc);
    return type;
  }
}

