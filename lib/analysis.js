var tern = require('tern');
var path = require('path');
var fs = require('fs');
var url = require('url');

var walk = require('acorn/dist/walk');
var plugin = require('./tern-def-api.js');
var scope = require('./define-path-info.js');
var util = require('./util.js');

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
    Defs: [],
    Refs: [],
    Docs: []
}

initTernServer(process.argv.slice(2));
console.log(JSON.stringify(out, null, 2));

function initTernServer(files) {
    localFiles = files;
    var defsPath = path.join(__dirname, "../node_modules/tern/defs/ecma5.json");
    var defs = JSON.parse(fs.readFileSync(defsPath, "utf8"));
    var browserDefsPath = path.join(__dirname, "../node_modules/tern/defs/browser.json");
    var browserDefs = JSON.parse(fs.readFileSync(browserDefsPath, "utf8"));
    // console.error("DEFS = ", defs);
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

    console.error("All ids = ", allIdents, " Undefined ids = ", undefinedIdents);
    if (allIdents != 0) {
        console.error("percentage of undefined ids = ", (undefinedIdents / allIdents) * 100, "%");
    }

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
            console.error("Error returned from Tern 'definition' request: " + error);
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
    // return getQueryInfo(file.name, offset, "definition", start);
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

//TODO refactor this method, bad approach for finding package.json
function getExternalRepoInfo(data) {
    if (data === null || data.origin === undefined) {
        return null;
    }

    if (localFiles.indexOf(data.origin) > -1 || data.origin.indexOf("node_modules") == -1) {
        return null;
    }

    if (data.origin === "node" || data.origin === "commonjs" || data.origin === "ecma5") {
        return null;
    }

    var filePath = path.normalize(data.origin);
    var pathRes = filePath.split("/");
    var json = fs.readFileSync(localDir + "/" + pathRes[0] + "/" + pathRes[1] + '/package.json');
    var packageJson = JSON.parse(json.toString());

    if (packageJson.repository === undefined) {
        console.error("PACKAGE json does not define repository ", packageJson);
        return null;
    }

    //var repo = packageJson.repository.url;
    //var repoInfo = repo.slice(repo.indexOf("://") + 3).replace(".git", "").replace(".js", "");

    return {
        repo: packageJson.repository.url,
        unit: pathRes[1],
        filePath: pathRes.slice(2).join("/")
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
                //console.error("INIT = ", decl.init);
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
            allIdents = allIdents + 1;
            var pathForId = formPathFromId(node);
            var data = getDefinition(node.sourceFile, node.end, node.start);
            var externalRepo = getExternalRepoInfo(data);

            var typeInfo = getType(node.sourceFile.name, node.end, node.start);
            var documentation = getDocumentation(node.sourceFile.name, node.end, node.start);
            var pathForDef = formPathFromData(data, externalRepo);

            if (data === null || pathForDef === null && data.url === undefined) {
                undefinedIdents = undefinedIdents + 1;
                console.error("EMPTY data for Identifier = ", node.name, "IN FILE = ", node.sourceFile.name);
                //console.error("DATA = ", data);
                return;
            }

            if (pathForDef === null && data.url !== undefined && kind !== "var") {
                //emmission of refs for environment vars
                var envRef = {
                    DefPath: data.url,
                    DefUnitType: "URL",
                    DefUnit: url.parse(data.url).host,
                    Def: false,
                    File: node.sourceFile.name,
                    Start: node.start,
                    End: node.end
                }
                out.Refs.push(envRef);
                return;
            }

            if (pathForDef === pathForId || ((kind === "var") && (pathForDef !== pathForId))) {
                //emit def here
                var scopePathForId = scope.mapLinesPathToScopePath(ternServer, {
                    file: node.sourceFile.name,
                    start: node.start,
                    end: node.end
                });
                if (scopePathForId === null || scopePathForId === undefined) {
                    undefinedIdents = undefinedIdents + 1;
                    console.error("SOURCE FILE = ", node.sourceFile.name);
                    console.error("ERROR OCCURRED IN MAPPING SCOPE ID PATH", pathForId, "NAME=", node.name);
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
                    TreePath: scopePathForId,
                    Data: defData
                };
                out.Defs.push(def);

                //emit fake ref here
                var ref = {
                    DefPath: scopePathForId,
                    Def: true,
                    File: node.sourceFile.name,
                    Start: node.start,
                    End: node.end
                }
                out.Refs.push(ref);

                //emission of Docs
                if (documentation !== null && documentation.doc !== undefined) {
                    var docData = {
                        Path: scopePathForId,
                        Format: "",
                        Data: documentation.doc
                    }

                    out.Docs.push(docData);
                }


            } else {
                //emit simple ref here
                var scopePathForDef = scope.mapLinesPathToScopePath(ternServer, {
                    file: data.origin,
                    start: data.start,
                    end: data.end
                });
                if (!scopePathForDef) {
                    if (data.url) {
                        var envRef = {
                            DefPath: data.url,
                            DefUnitType: "URL",
                            DefUnit: url.parse(data.url).host,
                            Def: false,
                            File: node.sourceFile.name,
                            Start: node.start,
                            End: node.end
                        }
                        out.Refs.push(envRef);
                        return;
                    };

                    undefinedIdents = undefinedIdents + 1;
                    console.error("ERROR OCCURRED IN MAPPING SCOPE DEF PATH for", pathForDef, "NAME=", node.name);
                    console.error("SOURCE FILE = ", node.sourceFile.name);
                    console.error("DATA = ", data);
                    console.error("External repo = ", externalRepo);
                    console.error("===================================");
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
                out.Refs.push(ref);
            }

            // console.error("Identifier = ", node.name, "IN file = ", node.sourceFile.name);
            // console.error(data);
            // console.error("Here inside identifier = ", formPathFromId(node));
            // console.error("Here inside id data = ", formPathFromData(data, externalRepo));
            // console.error("TYPE = ", getType(node.sourceFile.name, node.end, node.start));
            // console.error("DOC = ", getDocumentation(node.sourceFile.name, node.end));
            // console.error("\n ========================== \n");
        }
    });


    ternServer.files.forEach(function(file) {
        if (file.name.indexOf('node_modules') == -1) {
            walk.recursive(file.ast, "ast", null, searchVisitor);
        }
        //console.error("FILE = ", file);
        //console.error("AST = ", file.ast.body);
    });

    //console.error("DEFS = ", out.Defs);
    // console.error("REFS = ", out.Refs);
    // console.error("DOCS = ", out.Docs);
}
