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

var pathMap = [];

var resolvedFiles = [];

var currentScope;
var scopeCountResolver = [];


var pathVisitor = walk.make({
    //handling of FunctionDeclaration and FunctionExpression
    Function: function(node, scopeInfo, c) {
        if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
            return;
        }
        var newScope = scopeInfo.scope + "_fn_";
        var fileName = node.sourceFile.name;
        if (node.id) {
            var key = formPathForScope(fileName, node.id);
            newScope = resolveScopeCountPath(newScope + node.id.name);
            pathMap[key] = newScope;
            c(node.id, {
                scope: newScope,
                search: scopeInfo.search
            });
        } else {
            newScope = resolveScopeCountPath(newScope);
        }

        for (var i = 0; i < node.params.length; ++i) {
            var key = formPathForScope(fileName, node.params[i]);
            var paramScope = resolveScopeCountPath(newScope + "_param_" + node.params[i].name);
            pathMap[key] = paramScope;
            c(node.params[i], {
                scope: paramScope,
                search: scopeInfo.search
            });
        }

        c(node.body, {
            scope: newScope,
            search: scopeInfo.search
        });
    },

    VariableDeclaration: function(node, scopeInfo, c) {
        if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
            return;
        }
        var fileName = node.sourceFile.name;
        for (var i = 0; i < node.declarations.length; ++i) {
            var decl = node.declarations[i];

            var key = formPathForScope(fileName, decl.id);
            var newScope = resolveScopeCountPath(scopeInfo.scope + "_var_" + decl.id.name);
            pathMap[key] = newScope;
            c(decl.id, {
                scope: newScope,
                search: scopeInfo.search
            });
            if (decl.init) c(decl.init, {
                scope: newScope,
                search: scopeInfo.search
            });
        }
    },

    // check what happens with this
    MemberExpression: function(node, scopeInfo, c) {
        if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
            return;
        }
        currentScope = scopeInfo.scope;
        var fileName = node.sourceFile.name;
        var newScope = scopeInfo.scope;
        if (node.object.type == 'Identifier') {
            newScope = resolveScopeCountPath(newScope + "_obj_" + node.object.name);
            var keyObj = formPathForScope(fileName, node.object);
            pathMap[keyObj] = newScope;
            c(node.object, {
                scope: newScope,
                search: scopeInfo.search
            });
        } else {
            c(node.object, {
                scope: newScope,
                search: scopeInfo.search
            });
            newScope = currentScope;
        }

        if (node.property.type == 'Identifier') {
            newScope = resolveScopeCountPath(newScope + "_prop_" + node.property.name);
            keyProp = formPathForScope(fileName, node.property);
            pathMap[keyProp] = newScope;
        }
        c(node.property, {
            scope: newScope,
            search: scopeInfo.search
        });


        currentScope = newScope;
    },

    ObjectExpression: function(node, scopeInfo, c) {
        if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
            return;
        }
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
            }
            c(node.properties[i].key, {
                scope: newScope,
                search: scopeInfo.search
            });


            if (node.properties[i].value.type == 'Identifier') {
                var key_val = formPathForScope(fileName, node.properties[i].value);
                newScope = resolveScopeCountPath(newScope + "_obj_val_" + node.properties[i].value.name);
                pathMap[key_val] = newScope;
            }
            c(node.properties[i].value, {
                scope: newScope,
                search: scopeInfo.search
            });
        }
    },

    Identifier: function(node, scopeInfo, c) {
        if (scopeInfo.search != undefined && node.start == scopeInfo.search.start && node.end == scopeInfo.search.end) {
            throw {
                found: scopeInfo.scope
            };
        }
    }
});

module.exports.initLocalFilesScopePaths = function(ternServer, localFiles) {
    resolvedFiles = localFiles;
    scopeCountResolver = [];
    ternServer.files.forEach(function(file) {
        if (localFiles.indexOf(file.name) > -1) {
            walk.recursive(file.ast, {
                scope: getFilePathName(file.name)
            }, null, pathVisitor);
        }
    });
}

module.exports.mapLinesPathToScopePath = function(ternServer, defInfo) {
    var key = formPathForScope(defInfo.file, {
        start: defInfo.start,
        end: defInfo.end
    });
    var mapRes = pathMap[key];
    //if value was found in the map or file is not external, so was fully indexed
    if (mapRes != undefined || resolvedFiles.indexOf(defInfo.file) > -1) {
        return mapRes;
    }


    var lookupRes;
    scopeCountResolver = [];
    ternServer.files.forEach(function(file) {
        if (file.name === defInfo.file) {
            try {
                walk.recursive(file.ast, {
                    scope: getFilePathName(file.name),
                    search: defInfo
                }, null, pathVisitor);
            } catch (e) {
                if (e.found) {
                    lookupRes = e.found;
                    console.error("I am here, inside found");
                }
                //HERE not found
            }
        }

    });
    //console.error(pathMap);
    return lookupRes;
}
