//TODO check try statement and its influence on the scope
var walk = require("acorn/dist/walk");
var path = require("path");

function formPathForScope(fileName, data) {
    return fileName + "_" + data.start + "_" + data.end;
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

var pathMap = [];
exports.pathMap = pathMap;

module.exports.mapLinesPathToScopePath = function(ternServer) {
    var fnCount = 0;
    var objCount = 0;
    var varCount = 0;
    var currentScope;
    var pathVisitor = walk.make({
        // AssignmentExpression: function(node, scope, c) {
        //     if (node.right.type == 'FunctionExpression') {
        //         c(node.left, scope);
        //         var newScope = currentScope;
        //         c(node.right, newScope);
        //     } else {
        //         c(node.left, scope);
        //         c(node.right, scope);
        //     }
        // },

        // FunctionExpression: function(node, scope, c) {
        //     console.error("Node = ", node);
        //     c(node.body, scope);
        // },

        Function: function(node, scope, c) {
            fnCount = fnCount + 1;
            var newScope = scope + "_fn_";
            var fileName = node.sourceFile.name;
            if (node.id) {
                //c(node.id, "function");
                var key = formPathForScope(fileName, node.id);
                newScope = newScope + node.id.name + fnCount;
                pathMap[key] = newScope;
            } else {
                newScope = newScope + fnCount;
            }

            for (var i = 0; i < node.params.length; ++i) {
                var key = formPathForScope(fileName, node.params[i]);
                var paramScope = newScope + "_param_" + node.params[i].name;
                pathMap[key] = paramScope;
                c(node.params[i], paramScope);
            }

            c(node.body, newScope);
        },

        VariableDeclaration: function(node, scope, c) {
            varCount = varCount + 1;
            var fileName = node.sourceFile.name;
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];

                // c(decl.id, "var");
                var key = formPathForScope(fileName, decl.id);
                //console.error("DECL = ", decl.id);
                var newScope = scope + varCount + "_var_" + decl.id.name;
                pathMap[key] = newScope;
                if (decl.init) c(decl.init, newScope);
            }
        },

        // check what happens with this
        MemberExpression: function(node, scope, c) {
            currentScope = scope;
            var fileName = node.sourceFile.name;
            var newScope = scope;
            if (node.object.type == 'Identifier') {
                newScope = newScope + "_obj_" + node.object.name;
                var keyObj = formPathForScope(fileName, node.object);
                pathMap[keyObj] = newScope;
            } else {
                c(node.object, newScope);
                newScope = currentScope;
            }

            if (node.property.type == 'Identifier') {
                newScope = newScope + "_prop_" + node.property.name;
                keyProp = formPathForScope(fileName, node.property);
                pathMap[keyProp] = newScope;
            } else {
                c(node.property, newScope);
            }

            currentScope = newScope;
        },

        //do we need obj val for declaration?
        ObjectExpression: function(node, scope, c) {
            var fileName = node.sourceFile.name;
            objCount = objCount + 1;
            for (var i = 0; i < node.properties.length; ++i) {
                //console.error("TYPE = ", node.properties[i].value.type);
                //console.error("TYPE = ", node.properties[i].value);
                var newScope = scope + "_obj_" + objCount;
                if (node.objType !== undefined && node.objType.name) {
                    newScope = newScope + "_objType_" + node.objType.name;
                }
                if (node.properties[i].value.type == 'Identifier') {
                    var key_val = formPathForScope(fileName, node.properties[i].value);
                    var newScope_val = newScope + "_obj_val_" + node.properties[i].value.name;
                    pathMap[key_val] = newScope_val;
                } else {
                    c(node.properties[i].value, newScope);
                }

                if (node.properties[i].key.type == 'Identifier') {
                    var key_key = formPathForScope(fileName, node.properties[i].key);
                    var newScope_key = newScope + "_obj_key_" + node.properties[i].key.name;
                    pathMap[key_key] = newScope_key;
                } else {
                    c(node.properties[i].key, newScope);
                }
            }
        }
    });

    ternServer.files.forEach(function(file) {
        walk.recursive(file.ast, getFilePathName(file.name), null, pathVisitor);
    });

    //console.error(pathMap);
}
