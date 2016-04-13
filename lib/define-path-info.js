//TODO check try statement and its influence on the scope
var walk = require("acorn/dist/walk");
var path = require("path");

function formPathForScope(fileName, data) {
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

    return getFilePathName(fileName) + "_" + data.start + "_" + data.end;
}


var pathMap = [];
exports.pathMap = pathMap;

module.exports.mapLinesPathToScopePath = function(ternServer) {
    var fnCount = 0;
    var currentScope;
    var pathVisitor = walk.make({
        AssignmentExpression: function(node, scope, c) {
            if (node.right.type == 'FunctionExpression') {
                c(node.left, scope);
                var newScope = currentScope;
                c(node.right, newScope);
            } else {
                c(node.left, scope);
                c(node.right, scope);
            }
        },

        FunctionExpression: function(node, scope, c) {
            console.error("Node = ", node);
            c(node.body, scope);
        },

        Function: function(node, scope, c) {
            //console.error("FN NODE = ", node);
            fnCount = fnCount + 1;
            var newScope = scope + "_fn_";
            var fileName = node.sourceFile.name;
            if (node.id) {
                //c(node.id, "function");
                var key = formPathForScope(fileName, node.id);
                newScope = newScope + node.id.name
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
            var fileName = node.sourceFile.name;
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];

                // c(decl.id, "var");
                var key = formPathForScope(fileName, decl.id);
                //console.error("DECL = ", decl.id);
                var newScope = scope + "_var_" + decl.id.name;
                pathMap[key] = newScope;
                if (decl.init) c(decl.init, newScope);
            }
        }

        check what happens with this
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

        ObjectExpression: function(node, scope, c) {
            var fileName = node.sourceFile.name;
            for (var i = 0; i < node.properties.length; ++i) {
                var key_val = formPathForScope(fileName, node.properties[i].value);
                var newScope_val = scope + "_obj_val_" + node.properties[i].value.name;
                pathMap[key_val] = newScope_val;
                c(node.properties[i].value, newScope_val);

                var key_key = formPathForScope(fileName, node.properties[i].key);
                var newScope_key = scope + "_obj_key_" + node.properties[i].key.name;
                pathMap[key_key] = newScope_key;
                c(node.properties[i].key, newScope_key);
            }
        }
    });

    ternServer.files.forEach(function(file) {
        //walk.recursive(file.ast, file.name, null, pathVisitor);
    });

    //console.error(pathMap);
}
