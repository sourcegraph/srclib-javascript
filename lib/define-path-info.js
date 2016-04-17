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
        //console.error("File path name = ", pathRes.slice(2).join("/"));
        return pathRes.slice(2).join("/");
    } else {
        //console.error("File path name = ", fileName);
        return fileName;
    }
}

var pathMap = [];
exports.pathMap = pathMap;

module.exports.mapLinesPathToScopePath = function(ternServer) {
    function resolveScopeCountPath(scope) {
        var scopeCountRes = scopeCountResolver[scope];
        if (scopeCountRes === undefined) {
            scopeCountResolver[scope] = 1;
            return scope;
        } else {
            scopeCountResolver[scope] = scopeCountRes + 1;
            return scope + "_" + scopeCountRes;
        }
    }

    var currentScope;
    var scopeCountResolver = [];
    var pathVisitor = walk.make({
        //TODO - probably add parameters to signature
        //handling of FunctionDeclaration and FunctionExpression
        Function: function(node, scopeInfo, c) {
            var newScope = scopeInfo.scope + "_fn_";
            var fileName = node.sourceFile.name;
            if (node.id) {
                //c(node.id, "function");
                var key = formPathForScope(fileName, node.id);
                newScope = resolveScopeCountPath(newScope + node.id.name);
                pathMap[key] = newScope;
            } else {
                newScope = resolveScopeCountPath(newScope);
            }

            for (var i = 0; i < node.params.length; ++i) {
                var key = formPathForScope(fileName, node.params[i]);
                var paramScope = resolveScopeCountPath(newScope + "_param_" + node.params[i].name);
                pathMap[key] = paramScope;
                c(node.params[i], {
                    scope: paramScope,
                    prevNode: node
                });
            }

            c(node.body, {
                scope: newScope,
                prevNode: node
            });
        },

        VariableDeclaration: function(node, scopeInfo, c) {
            var fileName = node.sourceFile.name;
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];

                // c(decl.id, "var");
                var key = formPathForScope(fileName, decl.id);
                var newScope = resolveScopeCountPath(scopeInfo.scope + "_var_" + decl.id.name);
                pathMap[key] = newScope;
                if (decl.init) c(decl.init, {
                    scope: newScope,
                    prevNode: node
                });
            }
        },

        // check what happens with this
        MemberExpression: function(node, scopeInfo, c) {
            currentScope = scopeInfo.scope;
            var fileName = node.sourceFile.name;
            var newScope = scopeInfo.scope;
            if (node.object.type == 'Identifier') {
                newScope = resolveScopeCountPath(newScope + "_obj_" + node.object.name);
                var keyObj = formPathForScope(fileName, node.object);
                pathMap[keyObj] = newScope;
            } else {
                c(node.object, {
                    scope: newScope,
                    prevNode: node
                });
                newScope = currentScope;
            }

            if (node.property.type == 'Identifier') {
                newScope = resolveScopeCountPath(newScope + "_prop_" + node.property.name);
                keyProp = formPathForScope(fileName, node.property);
                pathMap[keyProp] = newScope;
            } else {
                c(node.property, {
                    scope: newScope,
                    prevNode: node
                });
            }

            currentScope = newScope;
        },

        //do we need obj val for declaration?
        ObjectExpression: function(node, scopeInfo, c) {
            var fileName = node.sourceFile.name;
            var newScope = scopeInfo.scope + "_obj_";
            for (var i = 0; i < node.properties.length; ++i) {
                if (node.objType !== undefined && node.objType.name) {
                    newScope = newScope + "_objType_" + node.objType.name;
                }

                if (node.properties[i].key.type == 'Identifier') {
                    var key_key = formPathForScope(fileName, node.properties[i].key);
                    newScope = resolveScopeCountPath(newScope + "_obj_key_" + node.properties[i].key.name);
                    pathMap[key_key] = newScope;
                } else {
                    c(node.properties[i].key, {
                        scope: newScope,
                        prevNode: node
                    });
                }

                if (node.properties[i].value.type == 'Identifier') {
                    var key_val = formPathForScope(fileName, node.properties[i].value);
                    newScope = resolveScopeCountPath(newScope + "_obj_val_" + node.properties[i].value.name);
                    pathMap[key_val] = newScope;
                } else {
                    c(node.properties[i].value, {
                        scope: newScope,
                        prevNode: node
                    });
                }
            }
        }
    });

    ternServer.files.forEach(function(file) {
        walk.recursive(file.ast, {
            scope: getFilePathName(file.name),
            prevNode: null
        }, null, pathVisitor);
    });

    console.error(pathMap);
}
