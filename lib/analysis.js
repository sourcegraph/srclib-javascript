var tern = require('tern');
var path = require("path");
var fs = require("fs");
var walk = require("acorn/dist/walk");


//var files = ["data/test.js", "data/test1.js"];
var localDir = process.cwd();
var ternServer = null;

var out = {
    Defs: [],
    Refs: [],
    Docs: []
}

module.exports.initTernServer = function(files) {
    var ternOptions = {
        async: false,
        getFile: function(file) {
            return fs.readFileSync(path.resolve(localDir, file), "utf8");
        },
        plugins: {
            "node": {},
            "requirejs": {},
            "modules": {},
            "es_modules": {},
            "commonjs": {},
            "doc_comment": {}
        }
    };
    ternServer = new tern.Server(ternOptions);

    files.forEach(function(file) {
        ternServer.addFile(file);
    });

    var data = null;
    ternServer.flush(function(err) {
        if (err) throw err;
        data = analyse_all();
    });
    return data;
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
    return getQueryInfo(file, offset, "definition", start);
}

function getCompletions(file, offset, start) {
    return getQueryInfo(file, offset, "completions", start);
}

function getDocumentation(file, offset, start) {
    return getQueryInfo(file, offset, "documentation", start);
}

function formPathFromId(id) {
    return id.sourceFile.name + "_" + id.start + "_" + id.end;
}

function formPathFromData(data) {
    if (data.origin === undefined || data.start === undefined || data.end === undefined) {
        return null;
    } else {
        return data.origin + "_" + data.start + "_" + data.end;
    }
}

function analyse_all() {

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
            console.error("INFO for id = ", node.name, "WITH KIND = ", kind);
            var pathForId = formPathFromId(node);
            var data = getDefinition(node.sourceFile.name, node.end, node.start);
            var pathForDef = formPathFromData(data);
            if (pathForDef === null) {
                //console.error("!!!!!!!!!!!! Def data == NULL for ", node.name);
                //console.error("\n ========================== \n");
                return;
            }

            if (pathForDef === pathForId) {
                //emit def here
                var type = getType(node.sourceFile.name, node.end, node.start);
                var defData = {
                    Type: type,
                    Keyword: kind,
                    Kind: kind,
                    Separator: " "
                };
                var def = {
                    Path: pathForId,
                    Name: node.name,
                    Kind: kind,
                    File: node.sourceFile.name,
                    DefStart: node.start,
                    DefEnd: node.end,
                    TreePath: pathForId,
                    Data: data
                };
                out.Defs.push(def);

                //emit fake ref here
                var ref = {
                    DefPath: pathForId,
                    Def: true,
                    File: node.sourceFile.name,
                    Start: node.start,
                    End: node.end
                }
                out.Refs.push(ref);
            } else {
                //emit simple ref here
                var ref = {
                    DefPath: pathForId,
                    Def: false,
                    File: node.sourceFile.name,
                    Start: node.start,
                    End: node.end
                }
                out.Refs.push(ref);

            }
            // console.error("Here inside identifier = ", formPathFromId(node));
            // console.error("Here inside id data = ", formPathFromData(data));
            // console.error(data);
            // console.error("TYPE = ", getType(node.sourceFile.name, node.end, node.start));
            // console.error("DOC = ", getDocumentation(node.sourceFile.name, node.end));
            // console.error("\n ========================== \n");

        }
    });


    ternServer.files.forEach(function(file) {
        //console.error("AST = ", file.ast);
        walk.recursive(file.ast, "ast", null, searchVisitor);
    });

    //console.error("DEFS = ", out.Defs);
    //console.error("REFS = ", out.Refs);
    return out;
}

//initTernServer(files);
