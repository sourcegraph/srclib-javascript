var XRegExp = require('xregexp');


module.exports.formatType = function(type, nodeInfo) {
  if (nodeInfo.kind === 'function') {
    return {kind: "function", type: nodeInfo.typeInfo};
  }

  var allTypes = simplifyFunctions(simplifyObjects(type)).split("|");
  var uniqModTypes = [];
  for (var i = 0; i < allTypes.length; i++) {
    if (uniqModTypes.indexOf(allTypes[i]) === -1) {
      uniqModTypes.push(allTypes[i]);
    }
  }

  var resType = uniqModTypes.join("|");

  //detects that type of var or property is function type
  return (resType.startsWith("(")) ? {kind: "function", type: resType} : {kind: "", type : resType};
}

function simplifyObjects(type) {
  var res = XRegExp.matchRecursive(type, "{", "}", 'g');

  var resType = type;
  for (var i = 0; i < res.length; i++) {
    resType = resType.replace("{" + res[i] + "}", "Object");
  }
  return resType;
}

function simplifyFunctions(type) {
  var res = XRegExp.matchRecursive(type, "fn\\(", "\\)", 'g');
  var resType = type;
  for (var i = 0; i < res.length; i++) {
    var fnSig = res[i];
    var paramsRes = fnSig.split(",");
    var paramNames = [];
    for (var j = 0; j < paramsRes.length; j++) {
      var param = paramsRes[j];
      paramNames.push(param.split(":")[0]);
    }
    var newFnSig = paramNames.join(", ");
    resType = resType.replace("fn(" + fnSig + ")", "(" + newFnSig + ")");
  }
  return resType;
}

