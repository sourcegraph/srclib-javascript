//TODO check try statement and its influence on the scope
var walk = require("acorn/dist/walk");
var path = require("path");

var util = require('./util.js');

function formPathForScope(fileName, data) {
    return util.formPath(fileName, data.start, data.end);
}

function getFilePathName(fileName) {
    var index = fileName.indexOf("node_modules");
    if (index > -1) {
        var filePath = util.normalizePath(fileName);
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
        return util.formPath(scope, scopeCountRes);
    }
}

var pathMap = [];

var resolvedFiles = [];

var currentScope;
var scopeCountResolver = [];

function matchRange(node, scopeInfo) {
    if (scopeInfo.search != undefined &&
        node.start == scopeInfo.search.start &&
        node.end == scopeInfo.search.end) {
        throw {
            found: scopeInfo.scope
        };
    }
}

var pathVisitor = walk.make({
    //Processing of object.defineProperty
    CallExpression: function(node, scopeInfo, c) {
        var fileName = node.sourceFile.name;
        if (node.callee.type == 'MemberExpression' &&
            node.callee.object.name == 'Object' && node.callee.property.name == 'defineProperty') {
            var obj = node.arguments[0];
            var property = node.arguments[1];
            var newScope = util.formPath(scopeInfo.scope, "obj_def_prop");


            if (obj.type == 'Identifier' || obj.type == 'Literal') {
                newScope = util.formPath(newScope, obj.name);
            } else if (property.type == 'Literal') {
                newScope = util.formPath(newScope, property.value);
            }

            var key = formPathForScope(fileName, property);
            pathMap[key] = resolveScopeCountPath(newScope);
        }
        c(node.callee, scopeInfo);
        for (var i = 0; i < node.arguments.length; ++i) {
            c(node.arguments[i], scopeInfo);
        }

    },

    ImportDeclaration: function(node, scopeInfo, c) {
        var fileName = node.sourceFile.name;
        var newScope = util.formPath(scopeInfo.scope, "import");
        for (var i = 0; i < node.specifiers.length; ++i) {
            if (node.specifiers[i].type == 'ImportDefaultSpecifier') {
                var id = node.specifiers[i].local;
                if (id.type == 'Identifier') {
                    var key = formPathForScope(fileName, id);
                    newScope = resolveScopeCountPath(util.formPath(newScope, id.name));
                    pathMap[key] = newScope;
                }
            }
            c(node.specifiers[i], {
                scope: newScope,
                search: scopeInfo.search
            });
        }
        c(node.source, {
            scope: newScope,
            search: scopeInfo.search
        });
    },

    //handling of FunctionDeclaration and FunctionExpression
    Function: function(node, scopeInfo, c) {
        // if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
        //     return;
        // }
        var newScope = util.formPath(scopeInfo.scope, "fn");
        var fileName = node.sourceFile.name;
        if (node.id) {
            var key = formPathForScope(fileName, node.id);
            newScope = resolveScopeCountPath(util.formPath(newScope, node.id.name));
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
            var paramScope = resolveScopeCountPath(util.formPath(newScope, "param", node.params[i].name));
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
        // if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
        //     return;
        // }
        var fileName = node.sourceFile.name;
        for (var i = 0; i < node.declarations.length; ++i) {
            var decl = node.declarations[i];

            var key = formPathForScope(fileName, decl.id);
            var newScope = resolveScopeCountPath(util.formPath(scopeInfo.scope, "var", decl.id.name));
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
        // if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
        //     return;
        // }
        currentScope = scopeInfo.scope;
        var fileName = node.sourceFile.name;
        var newScope = scopeInfo.scope;
        if (node.object.type == 'Identifier') {
            newScope = resolveScopeCountPath(util.formPath(newScope, "obj", node.object.name));
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
            newScope = resolveScopeCountPath(util.formPath(newScope, "prop", node.property.name));
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
        // if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
        //     return;
        // }
        var fileName = node.sourceFile.name;
        var newScope = util.formPath(scopeInfo.scope, "obj");
        for (var i = 0; i < node.properties.length; ++i) {
            var objScope = newScope;
            if (node.objType !== undefined && node.objType.name) {
                objScope = util.formPath(objScope, "objType", node.objType.name);
            }

            var keyScope = util.formPath(objScope, "obj_key");
            if (node.properties[i].key.type == 'Identifier') {
                var key_key = formPathForScope(fileName, node.properties[i].key);
                keyScope = resolveScopeCountPath(util.formPath(keyScope, node.properties[i].key.name));
                pathMap[key_key] = keyScope;
            }
            if (node.properties[i].key.type == 'Literal') {
                var key_key = formPathForScope(fileName, node.properties[i].key);
                keyScope = resolveScopeCountPath(util.formPath(keyScope, node.properties[i].key.value));
                pathMap[key_key] = keyScope;
            }
            c(node.properties[i].key, {
                scope: keyScope,
                search: scopeInfo.search
            });

            var valScope = keyScope;
            if (node.properties[i].value.type == 'Identifier') {
                var key_val = formPathForScope(fileName, node.properties[i].value);
                valScope = resolveScopeCountPath(util.formPath(valScope, "obj_val", node.properties[i].value.name));
                pathMap[key_val] = valScope;
            }
            c(node.properties[i].value, {
                scope: valScope,
                search: scopeInfo.search
            });
        }
    },
    Literal: matchRange,
    Identifier: matchRange,
    JSXElement: matchRange,
    ClassDeclaration: function (node, scopeInfo, c) {
        // append /class/NAME to path being built
        var scope = util.formPath(scopeInfo.scope, "class", node.id.name);
        var key = formPathForScope(node.sourceFile.name, node.id);
        pathMap[key] = scope;
        for (var i = 0; i < node.body.body.length; i++) {
            c(node.body.body[i], {
                scope: scope,
                search: scopeInfo.search
            });
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

     // console.error(pathMap);
};

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
    ternServer.files.some(function(file) {
        if (file.name === defInfo.file) {
            try {
                walk.recursive(file.ast, {
                    scope: getFilePathName(file.name),
                    search: defInfo
                }, null, pathVisitor);
            } catch (e) {
                if (e.found) {
                    lookupRes = e.found;
                }
                //HERE not found
            }
            return true;
        }
    });
    return lookupRes;
};
