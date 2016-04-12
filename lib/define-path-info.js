//TODO check try statement and its influence on the scope
var walk = require("acorn/dist/walk");
var path = require("path");

function formPathForScope(data, scope) {
    return data.sourceFile.name + "_" + data.id.start + "_" + data.id.end + " --> " + scope + "_fun_" + node.id.name;
}

var pathMap = [];
exports.pathMap = pathMap;

module.exports.mapLinesPathToScopePath = function(ternServer) {
    var pathVisitor = walk.make({
        Function: function(node, scope, c) {
            var newScope = scope + "_fn_";
            var fileName = node.sourceFile.name;
            if (node.id) {
                // c(node.id, "function");
                var key = getFilePathName(fileName + "_" + node.id.start + "_" + node.id.end);
                newScope = newScope + node.id.name
                pathMap[key] = newScope;
                //console.error(value, "-->", pathMap[key]);
            }

            for (var i = 0; i < node.params.length; ++i) {
                var key = getFilePathName(fileName + "_" + node.params[i].start + "_" + node.params[i].end);
                pathMap[key] = newScope + "_param_" + node.params[i].name;
                c(node.params[i], pathMap[key]);
            }

            c(node.body, newScope);
        },

        VariableDeclaration: function(node, scope, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];

                // c(decl.id, "var");
                var key = getFilePathName(node.sourceFile.name + "_" + decl.id.start + "_" + decl.id.end);
                var newScope = scope + "_var_" + decl.id.name;
                pathMap[key] = newScope;
                //console.error(key, "-->", pathMap[key]);
                if (decl.init) c(decl.init, newScope);
            }
        },

        MemberExpression: function(node, scope, c) {
            c(node.object, scope);
            var key = getFilePathName(node.sourceFile.name + "_" + node.property.start + "_" + node.property.end);
            var newScope = scope + "_prop_" + node.property.name;
            pathMap[key] = newScope;
            //console.error(key, "-->", pathMap[scope]);
            c(node.property, newScope);
        },

        ObjectExpression: function(node, scope, c) {
            for (var i = 0; i < node.properties.length; ++i) {
                // console.error("Object expression = ", node);
                // console.error("Object expression VALUE= ", node.properties[i].value);
                // console.error("Object expression KEY= ", node.properties[i].key);
                var key_val = getFilePathName(node.sourceFile.name + "_" + node.properties[i].value.start + "_" + node.properties[i].value.end);
                var newScope_val = scope + "_obj_val_" + node.properties[i].value.name;
                pathMap[key_val] = newScope_val;
                c(node.properties[i].value, scope);
                var key_key = getFilePathName(node.sourceFile.name + "_" + node.properties[i].key.start + "_" + node.properties[i].key.end);
                var newScope_key = scope + "_obj_val_" + node.properties[i].key.name;
                pathMap[key_key] = newScope_key;
                c(node.properties[i].key, scope);
            }
        },
        Identifier: function(node, scope, c) {}
    });

    ternServer.files.forEach(function(file) {
        walk.recursive(file.ast, file.name, null, pathVisitor);
    });

    console.error(pathMap);
}

function getFilePathName(fileName) {
    var index = fileName.indexOf("node_modules");
    if (index > -1) {
        var filePath = path.normalize(fileName);
        var pathRes = filePath.split("/");
        return pathRes.slice(2).join("/");
    } else {
        return fileName;
    }
}
