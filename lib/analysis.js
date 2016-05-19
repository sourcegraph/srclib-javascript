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
}

initTernServer(process.argv.slice(2));
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
            doc_comment: true
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
    }

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

function getDefinition(file, offset, start) {
    var query = {
        type: "definition",
        start: start,
        end: offset,
        file: file.name,
        docFormat: "full"
    }
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

function analyseAll() {

    var searchVisitor = walk.make({
        Function: function(node, kind, c) {
            if (node.id) {
                c(node.id, "function");
            }

            for (var i = 0; i < node.params.length; ++i)
                c(node.params[i], "param");
            c(node.body, "");
        },

        // TryStatement: function(node, st, c) {
        //     if (node.handler)
        //         c(node.handler.param, st);
        //     walk.base.TryStatement(node, st, c);

        // },

        VariableDeclaration: function(node, kind, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];

                c(decl.id, "var");
                if (decl.init) c(decl.init, "");
            }
        },
        MemberExpression: function(node, kind, c) {
            c(node.object, kind);
            c(node.property, "property");
        },
        ObjectExpression: function(node, kind, c) {
            for (var i = 0; i < node.properties.length; ++i) {
                c(node.properties[i].value, kind);
                c(node.properties[i].key, kind);
            }

        },
        Identifier: function(node, kind, c) {

            // skipping dummy identifiers
            if (node.name == "✖") {
                return;
            }

            allIdents = allIdents + 1;
            var pathForId = formPathFromId(node);
            var data = getDefinition(node.sourceFile, node.end, node.start);
            var externalRepo = getExternalRepoInfo(data);

            var typeInfo = getType(node.sourceFile.name, node.end, node.start);
            var documentation = getDocumentation(node.sourceFile.name, node.end, node.start);
            var pathForDef = formPathFromData(data, externalRepo);

            if (!data || !pathForDef && !data.url) {
                undefinedIdents = undefinedIdents + 1;
                logger.info("Unresolved %s [%d-%d] in %s", node.name, node.start, node.end, node.sourceFile.name);
                return;
            }

            if (pathForDef === null && data.url !== undefined && kind !== "var") {
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
                }
                out.Refs.add(envRef);
                return;
            }

            if (pathForDef === pathForId || ((kind === "var") && (pathForDef !== pathForId))) {
                // Emit definition
                var scopePathForId = scope.mapLinesPathToScopePath(ternServer, {
                    file: node.sourceFile.name,
                    start: node.start,
                    end: node.end
                });
                if (!scopePathForId) {
                    undefinedIdents = undefinedIdents + 1;
                    logger.info("Unresolved path %s [%d-%d] in %s", node.name, node.start, node.end, node.sourceFile.name);
                    return;
                }
                var defData = {
                    Type: typeInfo.type,
                    Keyword: kind,
                    Kind: kind,
                    Separator: " "
                };
                var def = {
                    Path: scopePathForId,
                    Name: node.name,
                    Kind: kind,
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
                }
                out.Refs.add(ref);

                // Emit documentation
                if (documentation !== null && documentation.doc !== undefined) {
                    var docData = {
                        Path: scopePathForId,
                        Format: "",
                        Data: documentation.doc
                    }

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
                        }
                        out.Refs.add(envRef);
                        return;
                    };

                    undefinedIdents = undefinedIdents + 1;
                    logger.info("Unresolved scope def path %s [%d-%d] in %s", node.name, node.start, node.end, node.sourceFile.name);
                    return;
                }
                var ref = {
                    DefPath: scopePathForDef,
                    Def: false,
                    File: node.sourceFile.name,
                    Start: node.start,
                    End: node.end
                }
                if (externalRepo != null) {
                    ref.DefRepo = externalRepo.repo;
                    ref.DefUnit = externalRepo.unit;
                }
                out.Refs.add(ref);
            }
        }
    });


    ternServer.files.forEach(function(file) {
        if (file.name.indexOf('node_modules') == -1) {
            walk.recursive(file.ast, "ast", null, searchVisitor);
        }
    });

}
