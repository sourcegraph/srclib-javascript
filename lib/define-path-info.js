//TODO check try statement and its influence on the scope
var walk = require("acorn/dist/walk");
var path = require("path");
var extend = require('util')._extend;

var util = require('./util.js');
var logger = require('./logger.js');

// typedefs
/**
 * span type definition
 * @typedef {Object} span
 * @property {number} start - start offset,
 */

/**
 * ScopeInfo type definition
 * @typedef {Object} ScopeInfo
 * @property {string} scope - scope path
 * @property {span} search - search span
 * @property {Object} methods visitor methods
 * @property {boolean} left if we are looking at property at the left side of assignment expression
 */

/**
 * ClassDefinition type definition
 * @typedef {Object} ClassDefinition
 * @property {string} path - path to class
 * @property {string} parent - parent class name
 * @property {Object.<string, boolean>} methods - class methods
 */

/**
 * @param {string} fileName node's filename
 * @param {span} data node's span
 * @return {string} path to given node in given file
 */
module.exports.formPathForScope = formPathForScope = function(fileName, data) {
    return util.formPath(fileName, data.start, data.end);
}

/**
 * Extracts file name after optional node_modules/MODULENAME (if file belongs to node_modules)
 * @param {string} fileName
 * @returns {string}
 */
function getFilePathName(fileName) {
    fileName = util.normalizePath(fileName);
    var match = /(?:^|\/)node_modules\/[^/]+\/(.+)/.exec(fileName);
    if (match) {
        return match[1];
    } else {
        return fileName;
    }
}

/**
 * Resolves name conflicts if there are multiple entries with the same scope
 * @param {string} scope scope to check
 * @return {string} scope if unique or scope with counter as a suffix (name1, name2, ...)
 */
function resolveScopeCountPath(scope) {
    var scopeCountRes = scopeCountResolver[scope];
    if (!scopeCountRes) {
        scopeCountResolver[scope] = 1;
        return scope;
    } else {
        scopeCountResolver[scope] = scopeCountRes + 1;
        return util.formPath(scope, scopeCountRes);
    }
}

module.exports.pathMap = pathMap = {};

var resolvedFiles = [];

var currentClass = null;
var currentScope;
var scopeCountResolver = [];

var classDefinitions = {};

/**
 * Stops traversal by throwing checked exception if node's span matches scope's span
 * @param {Object} node
 * @param {ScopeInfo} scopeInfo
 */
function matchRange(node, scopeInfo) {
    if (scopeInfo.search != undefined &&
        node.start == scopeInfo.search.start &&
        node.end == scopeInfo.search.end) {
        throw {
            found: scopeInfo.scope
        };
    }
}

/**
 * Constructs new scope object based on parent object and new scope by copying
 * required parent properties and adjusting path
 * @param {ScopeInfo} parent parent scope object
 * @param {string} scope new scope (path)
 * @returns {ScopeInfo} new scope object
 */
function makeScope(parent, scope) {
    return {
        scope: scope,
        search: parent.search,
        methods: parent.methods,
        left: parent.left
    };
}

/**
 * @param {string} className base class name
 * @param {string} methodName method name to look for
 * @returns {ClassDefinition} class definition of class (or any parent) that defines given method or null
 */
module.exports.definer = definer = function definer(className, methodName) {
    var def = classDefinitions[className];
    if (!def) {
        return null;
    }
    if (def.methods[methodName]) {
        return def;
    }
    if (def.parent) {
        return definer(def.parent, methodName);
    }
    return null;

}

/**
 * Tree visitor callback function
 *
 * @callback visitorCallback
 * @param {Object} node
 * @param {Object} scopeInfo
 */

var pathVisitor = walk.make({
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
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
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    ImportDeclaration: function(node, scopeInfo, c) {
        var fileName = node.sourceFile.name;
        var newScope = util.formPath(scopeInfo.scope, "import");
        for (var i = 0; i < node.specifiers.length; ++i) {
            if (util.isImportClauseForProcessing(node.specifiers[i].type)) {
                var id = node.specifiers[i].local;
                if (id.type == 'Identifier') {
                    var key = formPathForScope(fileName, id);
                    newScope = resolveScopeCountPath(util.formPath(newScope, id.name));
                    pathMap[key] = newScope;
                }
            }
            c(node.specifiers[i], makeScope(scopeInfo, newScope));
        }
        c(node.source, makeScope(scopeInfo, newScope));
    },
    /**
     * @param {Object} node current node (self for regular functions, value for method definitions)
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     * @param {Object} identNode identifier node (null for regular functions, key for method definitions)
     * @param {Object} rootNode root node (null for regulat functions, self for method definitions)
     */
    Function: function(node, scopeInfo, c, identNode, rootNode) {
        // if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
        //     return;
        // }
        var newScope = util.formPath(scopeInfo.scope, "fn");
        var fileName = node.sourceFile.name;

        // name may be computed in MethodDefinition() call where it may be synthetic
        // identNode may be computed in MethodDefinition() call
        if (!identNode) {
            identNode = node.id;
        }

        if (identNode) {
            // named function or method
            var name = identNode.name;
            if (rootNode) {
                if (rootNode.kind == "get") {
                    name = "-" + name;
                } else if (rootNode.kind == "set") {
                    name = "+" + name;
                }
            }
            newScope = resolveScopeCountPath(util.formPath(newScope, name));
            pathMap[formPathForScope(fileName, identNode)] = newScope;
            c(identNode, makeScope(scopeInfo, newScope));
        } else {
            // anonymous function
            newScope = resolveScopeCountPath(newScope);
        }

        for (var i = 0; i < node.params.length; ++i) {
            var param = node.params[i];
            if (param.argument) {
                // rest parameter (...foo)
                param = param.argument;
            } else if (param.left) {
                // default parameter (foo=bar)
                param = param.left;
            }
            var paramScope = resolveScopeCountPath(util.formPath(newScope, "param", param.name));
            pathMap[formPathForScope(fileName, param)] = paramScope;
            c(node.params[i], makeScope(scopeInfo, paramScope));
        }
        c(node.body, makeScope(scopeInfo, newScope));
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     * @param {Object[]} ids list of elements to process (when handling var [a,b,c] = ...)
     */
    VariableDeclaration: function(node, scopeInfo, c, ids) {
        // if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
        //     return;
        // }
        var fileName = node.sourceFile.name;
        if (!ids) {
            ids = node.declarations;
        }
        ids.forEach(function(decl) {
            var init = decl.init;
            if (decl.id) {
                decl = decl.id;
            }
            if (decl.type == "Identifier") {
                var key = formPathForScope(fileName, decl);
                var newScope = resolveScopeCountPath(util.formPath(scopeInfo.scope, "var", decl.name));
                pathMap[key] = newScope;
                c(decl, makeScope(scopeInfo, newScope));
                if (init) {
                    c(init, makeScope(scopeInfo, newScope));
                }
            } else if (decl.type == "ArrayPattern") {
                decl.elements.forEach(function(element) {
                    if (element) {
                        scopeInfo.methods.VariableDeclaration(element, scopeInfo, c, [element]);
                    }
                });
                if (init) {
                    c(init, scopeInfo);
                }
            } else if (decl.type == "ObjectPattern") {
                decl.properties.forEach(function(element) {
                    if (element) {
                        scopeInfo.methods.VariableDeclaration(element.key, scopeInfo, c, [element.key]);
                    }
                });
                if (init) {
                    c(init, scopeInfo);
                }
            }
        });
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    MemberExpression: function(node, scopeInfo, c) {
        // if (scopeInfo.search != undefined && (node.start > scopeInfo.search.start || node.end < scopeInfo.search.end)) {
        //     return;
        // }
        currentScope = scopeInfo.scope;
        var fileName = node.sourceFile.name;
        var newScope = null;
        var def;
        var baseClass = null;
        if (node.object.type == 'Identifier' && node.object.name != "✖") {
            newScope = resolveScopeCountPath(util.formPath(scopeInfo.scope, "obj", node.object.name));
            pathMap[formPathForScope(fileName, node.object)] = newScope;
            c(node.object, makeScope(scopeInfo, newScope));
        } else if (currentClass && node.object.type == 'ThisExpression') {
            // this.foo
            baseClass = currentClass;
            def = classDefinitions[currentClass];
            if (def && def.path) {
                pathMap[formPathForScope(fileName, node.object)] = def.path;
                newScope = def.path;
            }
        } else if (node.object.type == 'Super') {
            // super.foo
            def = classDefinitions[currentClass];
            if (def && def.parent) {
                baseClass = def.parent;
                def = classDefinitions[def.parent];
                if (def && def.path) {
                    pathMap[formPathForScope(fileName, node.object)] = def.path;
                    newScope = def.path;
                }
            }
        } else {
            c(node.object, makeScope(scopeInfo, currentScope || scopeInfo.scope));
            newScope = currentScope || scopeInfo.scope;
        }

        if (newScope && node.property.type == 'Identifier') {
            if (baseClass) {
                // super.x or this.x
                if (scopeInfo.left && (def = definer(baseClass, '+' + node.property.name))) {
                    // it's a setter
                    newScope = util.formPath(def.path, "fn", '+' + node.property.name);
                } else if (!scopeInfo.left && (def = definer(baseClass, '-' + node.property.name))) {
                    // it's a getter
                    newScope = util.formPath(def.path, "fn", '-' + node.property.name);
                } else if (def = definer(baseClass, node.property.name)) {
                    // it's a function
                    newScope = util.formPath(def.path, "fn", node.property.name);
                } else if (currentClass && classDefinitions[currentClass]) {
                    // it's class property
                    newScope = util.formPath(classDefinitions[currentClass].path, "prop", node.property.name);
                }
            } else {
                newScope = resolveScopeCountPath(util.formPath(newScope, "prop", node.property.name));
            }
            keyProp = formPathForScope(fileName, node.property);
            pathMap[keyProp] = newScope;
        }
        c(node.property, makeScope(scopeInfo, newScope || scopeInfo.scope));
        currentScope = newScope || scopeInfo.scope;
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
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
            var keyKey;
            if (node.properties[i].key.type == 'Identifier') {
                keyKey = formPathForScope(fileName, node.properties[i].key);
                keyScope = resolveScopeCountPath(util.formPath(keyScope, node.properties[i].key.name));
                pathMap[keyKey] = keyScope;
            }
            if (node.properties[i].key.type == 'Literal') {
                keyKey = formPathForScope(fileName, node.properties[i].key);
                keyScope = resolveScopeCountPath(util.formPath(keyScope, node.properties[i].key.value));
                pathMap[keyKey] = keyScope;
            }
            c(node.properties[i].key, makeScope(scopeInfo, keyScope));

            var valScope = keyScope;
            if (node.properties[i].value.type == 'Identifier') {
                var key_val = formPathForScope(fileName, node.properties[i].value);
                valScope = resolveScopeCountPath(util.formPath(valScope, "obj_val", node.properties[i].value.name));
                pathMap[key_val] = valScope;
            }
            c(node.properties[i].value, makeScope(scopeInfo, valScope));
        }
    },
    Literal: matchRange,
    Identifier: matchRange,
    ExportNamedDeclaration: function(node, scopeInfo, c) {
        if (node.declaration) {
            c(node.declaration, scopeInfo);
        }
    },
    ExportDefaultDeclaration: function(node, scopeInfo, c) {
        if (node.declaration) {
            c(node.declaration, scopeInfo);
        }
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    JSXElement: function(node, scopeInfo, c) {
        matchRange(node.openingElement, scopeInfo, c);
        node.openingElement.attributes.forEach(function(attr) {
            var n = attr.argument || attr.value;
            if (n) {
                c(n, scopeInfo);
            }
        });
        node.children.forEach(function(child) {
            c(child, scopeInfo);
        });
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    ClassDeclaration: function (node, scopeInfo, c) {
        var scope = util.formPath(scopeInfo.scope, "class");
        if (node.id && node.id.start < node.id.end) {
            // append /class/NAME to path being built
            scope = resolveScopeCountPath(util.formPath(scope, node.id.name));
            pathMap[formPathForScope(node.sourceFile.name, node.id)] = scope;
            currentClass = node.id.name;
            if (classDefinitions[currentClass]) {
                classDefinitions[currentClass].path = scope;
            }
        } else {
            scope = resolveScopeCountPath(scope);
            currentClass = scope;
            var parentClassName = null;
            if (node.superClass && node.superClass.id) {
                parentClassName = node.superClass.id;
            }
            classDefinitions[currentClass] = {
                path: scope,
                parent: parentClassName,
                methods: {}
            };
            pathMap[util.formPath(node.sourceFile.name, node.start, node.start + "class".length)] = scope;
        }
        if (currentClass && node.superClass && classDefinitions[currentClass]) {
            classDefinitions[currentClass].parent = node.superClass.name;
        }
        for (var i = 0; i < node.body.body.length; i++) {
            c(node.body.body[i], makeScope(scopeInfo, scope));
        }
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    ClassExpression: function (node, scopeInfo, c) {
        scopeInfo.methods.ClassDeclaration(node, scopeInfo, c);
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    MethodDefinition: function (node, scopeInfo, c) {
        scopeInfo.methods.Function(node.value,
            scopeInfo,
            c,
            node.key,
            node);
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    AssignmentExpression: function (node, scopeInfo, c) {
        var scope = makeScope(scopeInfo, scopeInfo.scope);
        scope.left = true;
        c(node.left, scope);
        scope = makeScope(scopeInfo, scopeInfo.scope);
        c(node.right, scope);
    },
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    AssignmentPattern: function (node, scopeInfo, c) {
        scopeInfo.methods.AssignmentExpression(node, scopeInfo, c);
    }
});

module.exports.initLocalFilesScopePaths = function(ternServer, localFiles) {
    resolvedFiles = localFiles;
    scopeCountResolver = [];
    // here we'll build classes cache to track class inheritance and available methods
    // we'll use special tree visitor
    var visitor = extend({}, pathVisitor);
    visitor.ClassDeclaration = function(node, state, cb) {
        if (node.id && node.id.start < node.id.end) {
            var className = node.id.name;
            var parentClassName = null;
            if (node.superClass && node.superClass.id) {
                parentClassName = node.superClass.id;
            }
            classDefinitions[className] = {
                path: "",
                parent: parentClassName,
                methods: {}
            };
            currentClass = className;
        } else {
            currentClass = null;
        }
        pathVisitor.ClassDeclaration(node, state, cb);
    };
    visitor.MethodDefinition = function(node, state, cb) {
        var def = classDefinitions[currentClass];
        if (def) {
            if (['constructor', 'get', 'set'].indexOf(node.kind) < 0) {
                def.methods[node.key.name] = 1;
            } else if ('get' == node.kind) {
                def.methods['-' + node.key.name] = 1;
            } else if ('set' == node.kind) {
                def.methods['+' + node.key.name] = 1;
            }
        }
        pathVisitor.MethodDefinition(node, state, cb);
    };
    visitor = walk.make(visitor);
    ternServer.files.forEach(function (file) {
        logger.info("Building scopes for", file.name);
        if (localFiles.indexOf(file.name) > -1) {
            walk.recursive(file.ast, {
                scope: getFilePathName(file.name),
                methods: visitor
            }, null, visitor);
        }
    });
};

module.exports.mapLinesPathToScopePath = function(ternServer, defInfo) {
    var key = formPathForScope(defInfo.file, {
        start: defInfo.start,
        end: defInfo.end
    });
    var mapRes = pathMap[key];
    //if value was found in the map or file is not external, so was fully indexed
    if (mapRes || resolvedFiles.indexOf(defInfo.file) > -1) {
        return mapRes;
    }

    var lookupRes;

    scopeCountResolver = [];
    ternServer.files.some(function(file) {
        if (file.name === defInfo.file) {
            try {
                walk.recursive(file.ast, {
                    scope: getFilePathName(file.name),
                    search: defInfo,
                    methods: pathVisitor
                }, null, pathVisitor);
            } catch (e) {
                if (e.found) {
                    lookupRes = e.found;
                } else {
                    logger.error(e);
                }
            }
            return true;
        }
    });
    return lookupRes;
};


/**
 *
 * @param {string} className
 * @returns {ClassDefinition} class definition for given class
 */
module.exports.getClass = function(className) {
    return classDefinitions[className];
};

/**
 *
 * @param {Object} node
 * @returns {string} computed path to given node
 */
module.exports.getPath = function(node) {
    return pathMap[formPathForScope(node.sourceFile.name, node)];
};
