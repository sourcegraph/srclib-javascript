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
require('tern/plugin/node');
require('tern/plugin/node_resolve');

//require('tern/plugin/requirejs');

var localDir = process.cwd();
var ternServer = null;

var localFiles = null;

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
    var defsPath = path.join(__dirname, "../node_modules/tern/defs/ecma5.json");
    var defs = JSON.parse(fs.readFileSync(defsPath, "utf8"));
    var browserDefsPath = path.join(__dirname, "../node_modules/tern/defs/browser.json");
    var browserDefs = JSON.parse(fs.readFileSync(browserDefsPath, "utf8"));
    var ternOptions = {
        dependencyBudget: 500000,
        projectDir: localDir,
        defs: [defs, browserDefs],
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

function getCompletions(file, offset, start) {
    return getQueryInfo(file, offset, "completions", start);
}

function getDocumentation(file, offset, start) {
    return getQueryInfo(file, offset, "documentation", start);
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

// TODO refactor this method, bad approach for finding package.json
function getExternalRepoInfo(data) {
    if (!data || !data.origin) {
        return null;
    }

    if (["node", "commonjs", "ecma5"].indexOf(data.origin) >= 0) {
        return null;
    }

    var filePath = util.normalizePath(data.origin);

    if (localFiles.indexOf(filePath) > -1) {
        return null;
    }

    // node_modules/... or .../node_modules/...
    var pos = filePath.indexOf("node_modules/");
    if (pos < 0 || pos > 0 && filePath.charAt(pos - 1) != "/") {
        return null;
    }
    var prefix = filePath.substring(0, pos);
    var suffix = filePath.substring(pos + "node_modules/".length);
    var pathRes = suffix.split("/");
    var packageJsonPath = path.join(prefix,  "node_modules", pathRes[0], "package.json");
    var json = fs.readFileSync(packageJsonPath);
    var packageJson = JSON.parse(json.toString());

    if (!packageJson.repository) {
        logger.debug("No repository defined in", packageJsonPath);
        return null;
    }

    return {
        repo: packageJson.repository.url,
        unit: pathRes[0],
        filePath: suffix
    };
}

function initNodeInfo(kind, typeInfo) {
    var nodeKind = kind || '';
    var nodeTypeInfo = typeInfo || '';

    return {
        kind: nodeKind,
        typeInfo: nodeTypeInfo
    };
}

function analyseAll() {

    // current class name
    var currentClass = null;

    var searchVisitor = walk.make({
        Function: function(node, nodeInfo, c) {
            var params = node.params.map(function(param) {
                // handling rest parameters
                return param.argument || param;
            });
            if (node.id) {
                var paramNames = params.map(function(param) {
                    return param.name;
                });
                c(node.id, initNodeInfo("function", "(" + paramNames.join(", ") + ")"));
            }
            params.forEach(function(param) {
                c(param, initNodeInfo("param"));
            });
            c(node.body, initNodeInfo("fn_body"));
        },

        // TryStatement: function(node, st, c) {
        //     if (node.handler)
        //         c(node.handler.param, st);
        //     walk.base.TryStatement(node, st, c);

        // },

        VariableDeclaration: function(node, nodeInfo, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];

                c(decl.id, initNodeInfo(node.kind));
                if (decl.init) {
                    c(decl.init, initNodeInfo("var_init"));
                }
            }
        },
        MemberExpression: function(node, nodeInfo, c) {
            c(node.object, initNodeInfo("object instance"));
            c(node.property, initNodeInfo("property"));
        },
        ObjectExpression: function(node, nodeInfo, c) {
            node.properties.forEach(function(property) {
                c(property.value, initNodeInfo("object value"));
                c(property.key, initNodeInfo(property.value.type == "FunctionExpression" ?
                    "function" :
                    "object property"));
            });
        },
        Identifier: function(node, nodeInfo, c) {

            // skipping dummy identifiers
            //  ✖ marks the spot, ternjs/acorn uses it to mark dummy nodes
            if (node.name == "✖") {
                return;
            }
            processIdent(node, nodeInfo, node.name);
        },
        Super: function(node, nodeInfo, c) {
            allIdents++;
            if (!currentClass) {
                undefinedIdents++;
                return;
            }
            var classDef = scope.getClass(currentClass);
            if (!classDef || !classDef.parent) {
                undefinedIdents++;
                return;
            }
            classDef = scope.getClass(classDef.parent);
            if (!classDef) {
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
        ThisExpression: function(node, nodeInfo, c) {
            allIdents++;
            if (!currentClass) {
                undefinedIdents++;
                return;
            }
            var classDef = scope.getClass(currentClass);
            if (!classDef) {
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
            if (node.id) {
                c(node.id, initNodeInfo("class"));
                currentClass = node.id.name;
            }
            if (node.superClass) {
                c(node.superClass);
            }
            for (var i = 0; i < node.body.body.length; i++) {
                c(node.body.body[i]);
            }
            currentClass = null;
        },
        MethodDefinition: function(node, nodeInfo, c) {
            if (node.kind == 'constructor') {
                allIdents++;
                if (!currentClass) {
                    undefinedIdents++;
                    return;
                }
                var classDef = scope.getClass(currentClass);
                if (!classDef) {
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
                return;
            }

            if (node.key) {
                c(node.key, initNodeInfo("function"));
            }
            c(node.value);
        },
        JSXElement: function(node, state, cb) {
            processIdent(node, state, node.openingElement.name.name);
            walk.base.JSXElement(node, state, cb);
        }
    });


    ternServer.files.forEach(function(file) {
        if (!/(^|\/)node_modules\//.exec(file.name)) {
            walk.recursive(file.ast, initNodeInfo("ast"), null, searchVisitor);
        }
    });

}

function processIdent(node, nodeInfo, name) {

    allIdents = allIdents + 1;
    var pathForId = formPathFromId(node);
    var data = getDefinition(node.sourceFile, node.end, node.start);
    var externalRepo = getExternalRepoInfo(data);

    var typeInfo = getType(node.sourceFile.name, node.end, node.start);
    var documentation = getDocumentation(node.sourceFile.name, node.end, node.start);
    var pathForDef = formPathFromData(data, externalRepo);

    if (!data || !pathForDef && !data.url) {
        undefinedIdents = undefinedIdents + 1;
        logger.info("Unresolved %s [%d-%d] in %s", name, node.start, node.end, node.sourceFile.name);
        return;
    }

    if (pathForDef === null && data.url !== undefined && nodeInfo.kind !== "var") {
        // Emit refs to environment variables
        var urlStruct = url.parse(data.url);
        var envRef = {
            DefPath: data.url,
            DefUnitType: "URL",
            DefRepo: urlStruct.protocol + (urlStruct.slashes ? "//" : "") + urlStruct.host,
            Def: false,
            File: node.sourceFile.name,
            Start: node.start,
            End: node.end
        };
        out.Refs.add(envRef);
        return;
    }

    if (pathForDef === pathForId || ((nodeInfo.kind === "var") && (pathForDef !== pathForId))) {
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
        var ref = {
            DefPath: scopePathForId,
            Def: true,
            File: node.sourceFile.name,
            Start: node.start,
            End: node.end
        };
        out.Refs.add(ref);

        // Emit documentation
        if (documentation !== null && documentation.doc !== undefined) {
            var docData = {
                Path: scopePathForId,
                Format: "",
                Data: documentation.doc
            };
            out.Docs.add(docData);
        }
    } else {
        // emit reference
        var scopePathForDef = scope.mapLinesPathToScopePath(ternServer, {
            file: data.origin,
            start: data.start,
            end: data.end
        });
        if (!scopePathForDef) {
            if (data.url) {
                var urlStruct = url.parse(data.url);
                var envRef = {
                    DefPath: data.url,
                    DefUnitType: "URL",
                    DefRepo: urlStruct.protocol + (urlStruct.slashes ? "//" : "") + urlStruct.host,
                    Def: false,
                    File: node.sourceFile.name,
                    Start: node.start,
                    End: node.end
                };
                out.Refs.add(envRef);
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
        if (externalRepo != null) {
            ref.DefRepo = externalRepo.repo;
            ref.DefUnit = externalRepo.unit;
        }
        out.Refs.add(ref);
    }
}