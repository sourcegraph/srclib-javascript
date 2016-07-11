var tern = require('tern');
var path = require('path');
var fs = require('fs');
var url = require('url');

var walk = require('acorn/dist/walk');

var FastSet = require("collections/fast-set");

var plugin = require('./tern-def-api.js');
var scope = require('./define-path-info.js');
var util = require('./util.js');
var logger = require('./logger.js');
var format = require('./type-format.js');

require('./reactjs.js');
require('tern/plugin/doc_comment');
require('tern/plugin/commonjs');
require('tern/plugin/modules');
require('tern/plugin/es_modules');
require('tern/plugin/node');
require('tern/plugin/node_resolve');
require('tern/plugin/es_modules');

//require('tern/plugin/requirejs');

var localDir = process.cwd();
var ternServer = null;

var localFiles = null;

var importVars = {};

var allIdents = 0;
var undefinedIdents = 0;

var out = {
    Defs: new FastSet([], function(a, b) {
        return a.Path == b.Path;
    }, function(o) {
        return o.Path;
    }),
    Refs: new FastSet([], function(a, b) {
        return a.DefPath == b.DefPath &&
            a.DefUnitType == b.DefUnitType &&
            a.DefRepo == b.DefRepo &&
            a.Def == b.Def &&
            a.File == b.File &&
            a.Start == b.Start &&
            a.End == b.End;
    }, function(o) {
        return [o.DefPath, o.DefUnitType, o.DefRepo, o.Def, o.File, o.Start, o.End].join("|");
    }),
    Docs: new FastSet([], function(a, b) {
        return a.Path == b.Path;
    }, function(o) {
        return o.Path;
    })
};

initTernServer(process.argv.slice(2).map(function(file) {
    return util.normalizePath(file);
}));
out.Defs = out.Defs.toArray();
out.Refs = out.Refs.toArray();
out.Docs = out.Docs.toArray();
console.log(JSON.stringify(out, null, 2));

function initTernServer(files) {
    localFiles = files;
    var ternOptions = {
        dependencyBudget: 500000,
        projectDir: localDir,
        defs: loadTernDefinitions(),
        async: false,
        getFile: function(file) {
            return fs.readFileSync(path.resolve(localDir, file), "utf8");
        },
        plugins: {
            node: true,
            requirejs: true,
            modules: true,
            es_modules: true,
            commonjs: true,
            doc_comment: true,
            reactjs: true
        }
    };

    ternServer = new tern.Server(ternOptions);

    files.forEach(function(file) {
        ternServer.addFile(file);
    });

    ternServer.flush(function(err) {
        if (err) throw err;
        scope.initLocalFilesScopePaths(ternServer, localFiles);
        analyseAll();
    });

    logger.info("Analysed %d identifiers, %d are not resolved (%d%%)", allIdents, undefinedIdents, (undefinedIdents / Math.max(allIdents, 1)) * 100);

    return out;
}

function getQueryInfo(file, offset, type, start) {
    var query = {
        type: type,
        start: start,
        end: offset,
        file: file,
        docFormat: "full"
    };

    var res = null;
    ternServer.request({
        query: query,
        offset: offset
    }, function(error, data) {
        if (error) {
            logger.warn("Tern server returned an error [type: %s, start: %d, end: %d, file: %s]: %s", type, start, offset, file, error);
            return;
        }
        res = data;
    });
    return res;
}

function getType(file, offset, start) {
    return getQueryInfo(file, offset, "type", start);
}

/**
 *
 * @param {string} file reference's file
 * @param {number} end end offset
 * @param {number} start start offset
 * @return {Object} definition that ref located in given file at the following span refers to
 *
 */
function getDefinition(file, end, start) {
    var query = {
        type: "definition",
        start: start,
        end: end,
        file: file.name,
        docFormat: "full"
    };
    return plugin.findDef(ternServer, query, file);
}

function getDocumentation(file, end, start) {
    return getQueryInfo(file, end, "documentation", start);
}

function formPathFromId(id) {
    return util.formPath(id.sourceFile.name, id.start, id.end);
}

function formPathFromData(data, externalRepo) {
    if (data === null) {
        return null;
    }
    if (externalRepo === null) {
        if (data.origin === undefined || data.start === undefined || data.end === undefined) {
            return null;
        } else {
            return util.formPath(data.origin, data.start, data.end);
        }
    } else {
        return util.formPath(externalRepo.filePath, data.start, data.end);
    }
}

//form module path for external modules, modules with 'node_modules' in path
function formPathForModule(externalRepo) {
    var res = externalRepo.filePath.split("/");
    res[0] = "module";
    return res.join("/");
}

/**
 * External repository object
 * @typedef {Object} ExternalRepositoryInfo
 * @property {string} repo repository URL
 * @property {string} unit unit name
 * @property {string} filePath file path (../node_modules/unit/....)
 */

/**
 *
 * @param data
 * @returns {ExternalRepositoryInfo}
 */
// TODO refactor this method, bad approach for finding package.json
function getExternalRepoInfo(data) {
    if (!data || !data.origin) {
        return null;
    }

    if (isStandardOrigin(data.origin)) {
        return null;
    }

    var filePath = util.normalizePath(data.origin);

    if (localFiles.indexOf(filePath) > -1) {
        return null;
    }

    // node_modules/... or .../node_modules/...
    matches = /(.*?)(?:^|\/)node_modules\/(([^/]+)\/.+)/.exec(filePath);
    if (!matches) {
        return null
    }

    var prefix = matches[1];
    var suffix = matches[3];

    var dirPath = path.join(prefix, "node_modules", suffix);

    //checking whether path contains directory after node_modules
    var packageJsonPath;
    if (fs.lstatSync(dirPath).isDirectory()) {
        packageJsonPath = path.join(prefix, "node_modules", suffix, "package.json");
    } else {
        packageJsonPath = path.join(prefix, "node_modules", "package.json");
    }

    //check whether package.json file exists in the determined path
    try {
        fs.statSync(packageJsonPath);
    } catch (e) {
        return null;
    }

    var json = fs.readFileSync(packageJsonPath);
    var packageJson = JSON.parse(json.toString());

    if (!packageJson.repository) {
        logger.debug("No repository defined in", packageJsonPath);
        return null;
    }

    return {
        repo: packageJson.repository.url,
        unit: suffix,
        filePath: matches[2]
    };
}

/**
 * NodeInfo type definition
 * @typedef {Object} NodeInfo
 * @property {string} kind
 * @property {string} typeInfo
 * @property {boolean} left
 */

/**
 *
 * @param {NodeInfo} parent object
 * @param kind
 * @param typeInfo
 * @returns {NodeInfo}
 */
function initNodeInfo(parent, kind, typeInfo) {
    var nodeKind = kind || '';
    var nodeTypeInfo = typeInfo || '';

    return {
        kind: nodeKind,
        typeInfo: nodeTypeInfo,
        left: parent.left
    };
}

/**
 * Emits ref for module inside import, export or require declaration
 * @param {Node} moduleData node which represents module data
 */
function emitModuleRef(moduleData) {
    var data = getDefinition(moduleData.sourceFile, moduleData.end, moduleData.start);
    var externalRepo = getExternalRepoInfo(data);

    //Emission of refs for external modules, modules from node_modules
    if (data.file && externalRepo) {
        var ref = {
            DefPath: formPathForModule(externalRepo),
            Def: false,
            File: moduleData.sourceFile.name,
            Start: moduleData.start,
            End: moduleData.end
        }
        ref.DefRepo = externalRepo.repo;
        ref.DefUnit = externalRepo.unit;
        out.Refs.add(ref);
        return;
    }
    //Emission of simple module refs - for local files
    if (data.origin && data.file && !isStandardOrigin(data.origin)) {
        var ref = {
            DefPath: "module/" + data.origin,
            Def: false,
            File: moduleData.sourceFile.name,
            Start: moduleData.start,
            End: moduleData.end
        }
        out.Refs.add(ref);
        return;
    }
    //Emission of standard common module refs - commomjs, ecma5...

    if (data.url) {
        var urlStruct = url.parse(data.url);
        var urlRef = {
            DefPath: data.url,
            DefUnitType: "URL",
            DefRepo: urlStruct.protocol + (urlStruct.slashes ? "//" : "") + urlStruct.host,
            Def: false,
            File: moduleData.sourceFile.name,
            Start: moduleData.start,
            End: moduleData.end
        }
        out.Refs.add(urlRef);
        return;
    }

    var fileName = moduleData.sourceFile.name;
    var sourcegraphPos = fileName.indexOf("sourcegraph\/");
    if (moduleData.value.startsWith("sourcegraph\/") > -1 && sourcegraphPos > -1) {
        var resolvedModuleName = fileName.substring(0, sourcegraphPos) + moduleData.value;
        if (!resolvedModuleName.endsWith(".js")) {
           resolvedModuleName = resolvedModuleName + ".js";
        }
        var ref = {
            DefPath: "module/" + resolvedModuleName,
            Def: false,
            File: fileName,
            Start: moduleData.start,
            End: moduleData.end
        }
        out.Refs.add(ref);
    }
}

function analyseAll() {

    // current class name stack
    var currentClass = [];

    var getCurrentClass = function() {
        return currentClass.length ? currentClass[currentClass.length - 1] : null;
    };

    var searchVisitor = walk.make({
        Function: function(node, nodeInfo, c) {
            var params = node.params.map(function(param) {
                // handling rest and default parameters
                return param.argument || param.left || param;
            });
            if (node.id) {
                var paramNames = params.map(function(param) {
                    return param.name;
                });
                c(node.id, initNodeInfo(nodeInfo, "function", "(" + paramNames.join(", ") + ")"));
            }
            node.params.forEach(function(param) {
                if (param.argument) {
                    // rest
                    c(param.argument, initNodeInfo(nodeInfo, "param"));
                } else if (param.left) {
                    // default
                    c(param.left, initNodeInfo(nodeInfo, "param"));
                    c(param.right, initNodeInfo(nodeInfo, "param"));
                } else {
                    // regular
                    c(param, initNodeInfo(nodeInfo, "param"));
                }
            });
            c(node.body, initNodeInfo(nodeInfo, "fn_body"));
        },
        ExportNamedDeclaration: function(node, nodeInfo, c) {
            for (var i = 0; i < node.specifiers.length; i++) {
                if (node.specifiers[i].local) {
                    c(node.specifiers[i].local, initNodeInfo(nodeInfo, "var"));
                }
            }

            if (node.source) {
                emitModuleRef(node.source);
            }
        },
        ImportDeclaration: function(node, nodeInfo, c) {
            for (var i = 0; i < node.specifiers.length; ++i) {
                if (node.specifiers[i].local) {
                    var specifier = node.specifiers[i].local;
                    var classDef = scope.getClass(specifier.name);
                    if (classDef) {
                        processIdent(specifier, nodeInfo, specifier.name, classDef.path);
                        continue;
                    }
                    var data = getDefinition(specifier.sourceFile, specifier.end, specifier.start);
                    var externalRepo = getExternalRepoInfo(data);
                    var pathForDef = formPathFromData(data, externalRepo);
                    var pathForId = formPathFromId(specifier);
                    //save data for import vars to link local usages to external file
                    importVars[pathForId] = {
                        pathForDef: pathForDef,
                        externalRepo: externalRepo,
                        data: data
                    };

                    c(node.specifiers[i].local, initNodeInfo(nodeInfo, "import_var"));
                }
            }

            if (node.source) {
                emitModuleRef(node.source);
            }
        },
        // TryStatement: function(node, st, c) {
        //     if (node.handler)
        //         c(node.handler.param, st);
        //     walk.base.TryStatement(node, st, c);

        // },

        VariableDeclaration: function(node, nodeInfo, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];
                c(decl.id, initNodeInfo(nodeInfo, node.kind));
                if (decl.init) {
                    c(decl.init, initNodeInfo(nodeInfo, "var_init"));
                }
            }
        },
        MemberExpression: function(node, nodeInfo, c) {
            c(node.object, initNodeInfo(nodeInfo, "object instance"));
            // special processing of this.foo because foo may refer to setter/getter
            // which tern cannot resolve properly yet
            // TODO: super.foo? qux.foo? where foo may refer to setter/getter
            if (getCurrentClass() && node.object.type == "ThisExpression") {
                var path;
                if (nodeInfo.left && scope.definer(getCurrentClass(), '+' + node.property.name)) {
                    // it's a setter
                    path = scope.getPath(node.property);
                    if (path) {
                        processIdent(node.property, initNodeInfo(nodeInfo, "setter"), node.property.name, path);
                        return;
                    }
                } else if (!nodeInfo.left && scope.definer(getCurrentClass(), '-' + node.property.name)) {
                    // it's a getter
                    path = scope.getPath(node.property);
                    if (path) {
                        processIdent(node.property, initNodeInfo(nodeInfo, "getter"), node.property.name, path);
                        return;
                    }
                }
            }
            c(node.property, initNodeInfo(nodeInfo, "property"));
        },
        ObjectExpression: function(node, nodeInfo, c) {
            node.properties.forEach(function(property) {
                c(property.value, initNodeInfo(nodeInfo, "object value"));
                c(property.key, initNodeInfo(nodeInfo, property.value.type == "FunctionExpression" ?
                    "function" :
                    "object property"));
            });
        },
        CallExpression: function(node, kind, c) {
            //Provides jump to modules while hovering on literal in require statement

            if (node.callee.name === 'require') {
                 console.error("source file = ", node.sourceFile.name);
                 console.error("Call expression arguments = ", node.arguments[0]);
                emitModuleRef(node.arguments[0]);
            }

            c(node.callee, kind);
            node.arguments.forEach(function(arg) {
                c(arg, kind);
            });
        },
        Identifier: function(node, nodeInfo) {

            // skipping dummy identifiers
            //  ✖ marks the spot, ternjs/acorn uses it to mark dummy nodes
            if (node.name == "✖") {
                return;
            }
            processIdent(node, nodeInfo, node.name);
        },
        Super: function(node) {
            allIdents++;
            if (!getCurrentClass()) {
                undefinedIdents++;
                logger.info("Unresolved 'super' (no class name) [%d-%d] in %s", node.start, node.end, node.sourceFile.name);
                return;
            }
            var classDef = scope.getClass(getCurrentClass());
            if (!classDef || !classDef.parent) {
                logger.info("Unresolved 'super' (no context) [%d-%d] in %s", node.start, node.end, node.sourceFile.name);
                undefinedIdents++;
                return;
            }
            classDef = scope.getClass(classDef.parent);
            if (!classDef) {
                logger.info("Unresolved 'super' (no parent context) [%d-%d] in %s", node.start, node.end, node.sourceFile.name);
                undefinedIdents++;
                return;
            }
            var ref = {
                DefPath: classDef.path,
                Def: false,
                File: node.sourceFile.name,
                Start: node.start,
                End: node.end
            };
            out.Refs.add(ref);

        },
        ThisExpression: function(node) {
            allIdents++;
            if (!getCurrentClass()) {
                logger.info("Unresolved 'this' (no class name) [%d-%d] in %s", node.start, node.end, node.sourceFile.name);
                undefinedIdents++;
                return;
            }
            var classDef = scope.getClass(getCurrentClass());
            if (!classDef) {
                logger.info("Unresolved 'this' (no context) [%d-%d] in %s", node.start, node.end, node.sourceFile.name);
                undefinedIdents++;
                return;
            }

            var ref = {
                DefPath: classDef.path,
                Def: false,
                File: node.sourceFile.name,
                Start: node.start,
                End: node.end
            };
            out.Refs.add(ref);
        },
        ClassDeclaration: function(node, nodeInfo, c) {
            if (node.id && node.id.start < node.id.end) {
                c(node.id, initNodeInfo(nodeInfo, "class"));
                currentClass.push(node.id.name);
            } else {
                var path = scope.pathMap[util.formPath(node.sourceFile.name, node.start, node.start + "class".length)];
                if (!path) {
                    return;
                }
                currentClass.push(path);
                out.Defs.add({
                    Path: path,
                    Name: "class",
                    Kind: "class",
                    File: node.sourceFile.name,
                    DefStart: node.start,
                    DefEnd: node.start + "class".length,
                    Data: {
                        Type: "class",
                        Keyword: "class",
                        Kind: "class",
                        Separator: " "
                    }
                });
                out.Refs.add({
                    DefPath: path,
                    Def: true,
                    File: node.sourceFile.name,
                    Start: node.start,
                    End: node.start + "class".length
                });
            }
            if (node.superClass) {
                c(node.superClass, initNodeInfo(nodeInfo, "class"));
            }
            for (var i = 0; i < node.body.body.length; i++) {
                c(node.body.body[i], initNodeInfo(nodeInfo, "class_body"));
            }
            currentClass.pop();
        },
        ClassExpression: function(node, nodeInfo, c) {
            searchVisitor.ClassDeclaration(node, nodeInfo, c);
        },
        MethodDefinition: function(node, nodeInfo, c) {
            if (node.kind == 'constructor') {
                allIdents++;
                if (!getCurrentClass()) {
                    logger.info("Unresolved 'construct' (no class name) [%d-%d] in %s", node.start, node.end, node.sourceFile.name);
                    undefinedIdents++;
                    return;
                }
                var classDef = scope.getClass(getCurrentClass());
                if (!classDef) {
                    logger.info("Unresolved 'construct' (no context) [%d-%d] in %s", node.start, node.end, node.sourceFile.name);
                    undefinedIdents++;
                    return;
                }

                var ref = {
                    DefPath: classDef.path,
                    Def: false,
                    File: node.sourceFile.name,
                    Start: node.key.start,
                    End: node.key.end
                };
                out.Refs.add(ref);
            } else if (node.kind == 'get' || node.kind == 'set') {
                // special processing of getters and setters
                allIdents++;
                if (!getCurrentClass()) {
                    logger.info("Unresolved getter/setter (no class name) [%d-%d] in %s",
                        node.start, node.end, node.sourceFile.name);
                    undefinedIdents++;
                    return;
                }
                var path = scope.getPath(node.key);
                out.Defs.add({
                    Path: path,
                    Name: node.key.name,
                    Kind: node.kind,
                    File: node.sourceFile.name,
                    DefStart: node.key.start,
                    DefEnd: node.key.end,
                    Data: {
                        Type: node.kind == "set" ? "" : "?", // TODO: can we resolve type for getter?
                        Keyword: node.kind,
                        Kind: node.kind,
                        Separator: ""
                    }
                });
                out.Refs.add({
                    DefPath: path,
                    Def: true,
                    File: node.sourceFile.name,
                    Start: node.key.start,
                    End: node.key.end
                });
            } else {
                if (node.key) {
                    c(node.key, initNodeInfo(nodeInfo, "function"));
                }
            }
            c(node.value, initNodeInfo(nodeInfo, "method_value"));
        },
        JSXElement: function(node, nodeInfo, c) {
            var nameNode = node.openingElement.name;
            var classDef = scope.getClass(nameNode.name);
            if (classDef) {
                processIdent(nameNode, nodeInfo, nameNode.name, classDef.path);
            }
            node.openingElement.attributes.forEach(function(attr) {
                var n = attr.argument || attr.value;
                if (n) {
                    c(n, initNodeInfo(nodeInfo, "attr"));
                }
            });
            walk.base.JSXElement(node, nodeInfo, c);
        },
        // JSXIdentifier: function(node, nodeInfo, c) {
        //     processIdent(node, nodeInfo, node.name);
        // },
        AssignmentExpression: function(node, nodeInfo, c) {
            // to resolve properly setters and getters we should have context
            // (left or right side or assignment expression)
            var newNodeInfo = initNodeInfo(nodeInfo, "left");
            newNodeInfo.left = true;
            c(node.left, newNodeInfo);
            newNodeInfo = initNodeInfo(nodeInfo, "right");
            c(node.right, newNodeInfo);
        },
        VariablePattern: function(node, nodeInfo, c) {
            // default implementation does nothing, but we should extract identifiers
            searchVisitor.Identifier(node, nodeInfo, c);
        }
    });

    ternServer.files.forEach(function(file) {
        if (!/(^|\/)node_modules\//.exec(file.name)) {
            logger.info("Processing", file.name);
            walk.recursive(file.ast, initNodeInfo("ast"), null, searchVisitor);

            //add definition for each file-module representation and fake ref
            var kind = "module";
            var name = file.name;
            console.error("MODULE name = ", name);
            var defPath = kind + "/" + name;
            var defData = {
                Type: kind,
                Keyword: kind,
                Kind: kind,
                Separator: " "
            };
            var def = {
                Path: defPath,
                Name: name,
                Kind: kind,
                File: name,
                DefStart: file.ast.start,
                Data: defData
            };
            out.Defs.add(def);

            // Emit fake reference
            var ref = {
                DefPath: defPath,
                Def: true,
                File: name,
                Start: file.ast.start
            };
            out.Refs.add(ref);

            // console.error("AST = ", file.ast.body);
        }
    });
}

function processIdent(node, nodeInfo, name, path) {
    allIdents = allIdents + 1;
    var pathForId = formPathFromId(node);
    var data = getDefinition(node.sourceFile, node.end, node.start);

    var externalRepo;
    var pathForDef;
    if (path) {
        pathForDef = path;
    } else if (data && typeof data.start == 'undefined' && !isStandardOrigin(data.origin)) {
        // HACK it would be better to get this information from tern however
        // there are cases when tern returns empty/incomplete info
        // see https://github.com/ternjs/tern/issues/792
        // also: static methods, getter/setters
        pathForDef = scope.formPathForScope(node.sourceFile.name, node);
    } else {
        externalRepo = getExternalRepoInfo(data);
        pathForDef = formPathFromData(data, externalRepo);
    }

    //if var origin is an import declaration, get external data
    if (importVars[pathForDef]) {
        var importVarDecl = importVars[pathForDef];
        var importScopePathForDef = scope.mapLinesPathToScopePath(ternServer, {
            file: importVarDecl.data.origin,
            start: importVarDecl.data.start,
            end: importVarDecl.data.end
        });
        if (importScopePathForDef) {
            pathForDef = importVarDecl.pathForDef;
            externalRepo = importVarDecl.externalRepo;
            data = importVarDecl.data;
        }
    }

    var typeInfo = getType(node.sourceFile.name, node.end, node.start);
    var documentation = getDocumentation(node.sourceFile.name, node.end, node.start);

    var urlStruct;

    if (!data || !pathForDef && !data.url) {
        undefinedIdents = undefinedIdents + 1;
        logger.info("Unresolved %s [%d-%d] in %s", name, node.start, node.end, node.sourceFile.name);
        return;
    }

    if (pathForDef === null && data.url !== undefined && nodeInfo.kind !== "var") {
        // Emit refs to environment variables
        urlStruct = url.parse(data.url);
        out.Refs.add({
            DefPath: data.url,
            DefUnitType: "URL",
            DefRepo: urlStruct.protocol + (urlStruct.slashes ? "//" : "") + urlStruct.host,
            Def: false,
            File: node.sourceFile.name,
            Start: node.start,
            End: node.end
        });
        return;
    }

    var scopePathForDef = path || scope.mapLinesPathToScopePath(ternServer, {
        file: data.origin,
        start: data.start,
        end: data.end
    });
    if (pathForDef === pathForId || ((nodeInfo.kind === "var") && (pathForDef !== pathForId)) || ((nodeInfo.kind === "import_var") && !scopePathForDef)) {
        // Emit definition
        var scopePathForId = scope.mapLinesPathToScopePath(ternServer, {
            file: node.sourceFile.name,
            start: node.start,
            end: node.end
        });
        if (!scopePathForId) {
            undefinedIdents = undefinedIdents + 1;
            logger.info("Unresolved path %s [%d-%d] in %s", name, node.start, node.end, node.sourceFile.name);
            return;
        }

        var typeFormat = format.formatType(typeInfo.type, nodeInfo);
        var resKind = typeFormat.kind || nodeInfo.kind;
        var defData = {
            Type: typeFormat.type,
            Keyword: resKind,
            Kind: nodeInfo.kind,
            Separator: resKind === "function" ? "" : " "
        };
        var def = {
            Path: scopePathForId,
            Name: name,
            Kind: nodeInfo.kind,
            File: node.sourceFile.name,
            DefStart: node.start,
            DefEnd: node.end,
            Data: defData
        };
        out.Defs.add(def);

        // Emit fake reference
        out.Refs.add({
            DefPath: scopePathForId,
            Def: true,
            File: node.sourceFile.name,
            Start: node.start,
            End: node.end
        });

        // Emit documentation
        //if documentation.url is not empty, doc entry is taken from type definition, so right now we ignore such case
        if (documentation && documentation.doc && !documentation.url) {
            out.Docs.add({
                Path: scopePathForId,
                Format: "",
                Data: documentation.doc
            });
        }
    } else {
        // emit reference
        var scopePathForDef = path || scope.mapLinesPathToScopePath(ternServer, {
            file: data.origin,
            start: data.start,
            end: data.end
        });
        if (!scopePathForDef) {
            if (data.url) {
                urlStruct = url.parse(data.url);
                out.Refs.add({
                    DefPath: data.url,
                    DefUnitType: "URL",
                    DefRepo: urlStruct.protocol + (urlStruct.slashes ? "//" : "") + urlStruct.host,
                    Def: false,
                    File: node.sourceFile.name,
                    Start: node.start,
                    End: node.end
                });
                return;
            }

            undefinedIdents = undefinedIdents + 1;
            logger.info("Unresolved scope def path %s [%d-%d] in %s", name, node.start, node.end, node.sourceFile.name);
            return;
        }
        var ref = {
            DefPath: scopePathForDef,
            Def: false,
            File: node.sourceFile.name,
            Start: node.start,
            End: node.end
        };
        if (externalRepo) {
            ref.DefRepo = externalRepo.repo;
            ref.DefUnit = externalRepo.unit;
        }
        out.Refs.add(ref);
    }
}

/**
 * Loads all tern definitions
 * @return {Object[]} parsed definitions
 */
function loadTernDefinitions() {
    return [
        readTernDefinitions(('ecma5')),
        readTernDefinitions(('ecma6')),
        readTernDefinitions(('browser'))
    ];
}

/**
 * Loads specific tern definitions
 * @param {string} id definitions id (for example ecma5)
 * @return {Object} parsed definitions
 */
function readTernDefinitions(id) {
    var p = path.join(__dirname, "../node_modules/tern/defs/" + id + ".json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * @param {string} origin
 * @returns {boolean} true if origin points to "standard" one
 */
function isStandardOrigin(origin) {
    return ["node", "commonjs", "ecma5", "ecma6", "browser"].indexOf(origin) >= 0;
}
