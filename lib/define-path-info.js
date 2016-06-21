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
 * @property {number} start - start offset
 * @property {number} end - end offset
 */

/**
 * ScopeInfo type definition
 * @typedef {Object} ScopeInfo
 * @property {string} scope - scope path
 * @property {span} search - search span
 * @property {Object} methods visitor methods
 */

/**
 * @param {string} fileName node's filename
 * @param {span} data node's span
 * @return {string} path to given node in given file
 */
function formPathForScope(fileName, data) {
    return util.formPath(fileName, data.start, data.end);
}

/**
 * Extracts file name after optional node_modules/MODULENAME (if file belongs to node_modules)
 * @param {string} fileName
 * @returns {string}
 */
function getFilePathName(fileName) {
    fileName = util.normalizePath(fileName);
    var match = /(^|\/)node_modules\/[^/]+?\/(.+)/.exec(fileName);
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

var pathMap = [];

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
        methods: parent.methods
    };
}

/**
 * @param {string} className base class name
 * @param {string} methodName method name to look for
 * @returns class name of class (or any parent) that defines given method or null
 */
function whichDefines(className, methodName) {
    var def = classDefinitions[className];
    if (!def) {
        return null;
    }
    if (def.methods[methodName]) {
        return className;
    }
    if (def.parent) {
        return whichDefines(def.parent, methodName);
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
            if (node.specifiers[i].type == 'ImportDefaultSpecifier') {
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
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     * @param {Object} identNode
     */
    Function: function(node, scopeInfo, c, identNode) {
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
            newScope = resolveScopeCountPath(util.formPath(newScope, identNode.name));
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
     */
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
            c(decl.id, makeScope(scopeInfo, newScope));
            if (decl.init) c(decl.init, makeScope(scopeInfo, newScope));
        }
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
        if (node.object.type == 'Identifier') {
            newScope = resolveScopeCountPath(util.formPath(newScope, "obj", node.object.name));
            pathMap[formPathForScope(fileName, node.object)] = newScope;
            c(node.object, makeScope(scopeInfo, newScope));
        } else if (node.object.type == 'ThisExpression') {
            // this.foo
            baseClass = currentClass;
            def = classDefinitions[currentClass];
            if (def && def.path) {
                pathMap[formPathForScope(fileName, node.object)] = def.path;
                newScope = def.path;
            }
        } if (node.object.type == 'Super') {
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
            c(node.object, makeScope(scopeInfo, newScope));
            newScope = currentScope;
        }

        if (newScope && node.property.type == 'Identifier') {
            if (baseClass) {
                // super.x or this.x
                var definer = whichDefines(baseClass, node.property.name);
                if (definer) {
                    // it's a function
                    newScope = util.formPath(newScope, "fn", node.property.name);
                } else if (currentClass) {
                    // it's class property
                    newScope = util.formPath(classDefinitions[currentClass].path, "prop", node.property.name);
                }
            } else {
                newScope = resolveScopeCountPath(util.formPath(newScope, "prop", node.property.name));
            }
            keyProp = formPathForScope(fileName, node.property);
            pathMap[keyProp] = newScope;
        }
        c(node.property, makeScope(scopeInfo, newScope));
        currentScope = newScope;
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
    JSXElement: matchRange,
    /**
     * @param {Object} node
     * @param {ScopeInfo} scopeInfo
     * @param {visitorCallback} c
     */
    ClassDeclaration: function (node, scopeInfo, c) {
        var scope = util.formPath(scopeInfo.scope, "class");
        if (node.id) {
            // append /class/NAME to path being built
            scope = resolveScopeCountPath(util.formPath(scope, node.id.name));
            pathMap[formPathForScope(node.sourceFile.name, node.id)] = scope;
            currentClass = node.id.name;
            classDefinitions[currentClass].path = scope;
        } else {
            scope = resolveScopeCountPath(scope);
            currentClass = null;
        }
        if (currentClass && node.superClass) {
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
    MethodDefinition: function (node, scopeInfo, c) {
        scopeInfo.methods.Function(node.value,
            scopeInfo,
            c,
            node.key);
    }
});

module.exports.initLocalFilesScopePaths = function(ternServer, localFiles) {
    resolvedFiles = localFiles;
    scopeCountResolver = [];
    // here we'll build classes cache to track class inheritance and available methods
    // we'll use special tree visitor
    var visitor = extend({}, pathVisitor);
    visitor.ClassDeclaration = function(node, state, cb) {
        if (node.id) {
            var className = node.id.name;
            var parentClassName = null;
            if (node.superClass && node.superClass.id) {
                parentClassName = node.superClass.id;
            }
            classDefinitions[className] = {
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
            }
        }
        pathVisitor.MethodDefinition(node, state, cb);
    };
    visitor = walk.make(visitor);
    ternServer.files.forEach(function (file) {
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
 * @returns {Object} class definition for given class
 */
module.exports.getClass = function(className) {
    return classDefinitions[className];
};