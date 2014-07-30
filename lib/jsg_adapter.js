var execFile = require("child_process").execFile;
var path = require("path");

// run jsg on srcunit (a CommonJSPackage), calling cb(err, graphData).
module.exports.run = function(dir, srcunit, cb) {
  // TODO(sqs): add support for configuring/using tern plugins in the Srcfile
  // TODO(sqs): only use these nodePluginOpts if we are graphing a node.js pkg
  var nodePluginOpts = {coreModulesDir: path.join(__dirname, "../node_modules/jsg/testdata/node_core_modules")};
  var args = [path.join(__dirname, "../node_modules/jsg/bin/jsg"), "--plugin", "node="+JSON.stringify(nodePluginOpts)];
  srcunit.Files.forEach(function(f) {
    args.push(path.join(dir, f));
  });

  execFile(process.execPath /* node */, args, {maxBuffer: 50*1024*1024}, function(err, stdout, stderr) {
    if (stderr) console.error(stderr);
    if (err) {
      cb(err, null);
      return;
    }

    var jsgData = JSON.parse(stdout);

    var graphData = convertJSGData(jsgData);

    cb(null, graphData);
  });
};

// convertJSGData converts from jsg output format to srclib output format.
function convertJSGData(data) {
  var out = {
    Symbols: [],
    Refs: [],
    Docs: [],
    Propg: [], // TODO(sqs): add propg support, and check that this is the right field name
  };

  data.symbols.forEach(function(jsym) {
    var symData = convertSymbol(jsym);
    if (symData) {
      out.Symbols.push.apply(out.Symbols, symData.Symbols);
      out.Refs.push.apply(out.Refs, symData.Refs);
      out.Propg.push.apply(out.Propg, symData.Propgs);
      out.Docs.push.apply(out.Docs, symData.Docs);
    }
  });

  data.refs.forEach(function(jref) {
    var ref = convertRef(jref);
    if (ref) {
      out.Refs.push(ref);
    }
  });

  return out;
}

// keyToSymbolPath converts from a jsg key to a srclib def path.
function keyToSymbolPath(key) {
  key.path = JSON.stringify(key.path).slice(1,-1); // escape string
  if (!key.module) return [key.namespace, "-", key.path].join("/");
  if (!key.path) return [key.namespace, key.module].join("/");
  return [key.namespace, key.module, "-", key.path.replace(/\./g, "/")].join("/");
}

// TODO implement
function keyToSymbolTreePath(key) {
  key.path = key.path.replace(/\/\//g, "/"); // hack so we don't break on paths containing "//"
  key.path = JSON.stringify(key.path).slice(1,-1); // escape string

  var namespaceComponents = key.namespace.split("/").map(function(c) { return "-" + c; });
  var ghostedNamespace = namespaceComponents.join("/");

  if (!key.module) return [ghostedNamespace, "-", key.path].join("/");
  if (!key.path) return [ghostedNamespace, key.module].join("/");
  return [ghostedNamespace, key.module, "-", key.path.replace(/\./g, "/").replace(/\/\//g, "/")].join("/");
}

// convertSymbol returns an object {Symbols: [...], Refs: [...], Docs: [...],
// Propg: [...]} whose map value arrays should be appended to the whole output
// (convertJSGData "out").
function convertSymbol(jsym) {
  var out = {
    Symbols: [],
    Refs: [],
    Docs: [],
    Propg: [], // TODO(sqs): add propg support, and check that this is the right field name
  };

  // unexported if it has (or is underneath) a name prefixed with "_" or that
  // contains "<i>" (the array element marker)
  var exported = jsym.exported && !strHasPrefix(jsym.key.path, "_") && !strContains(jsym.key.path, "._") && !strContains(jsym.key.path, "<i>");

  var isFunc = strHasPrefix(jsym.type, "fn(");
  var path = keyToSymbolPath(jsym.key);
  var treePath = keyToSymbolTreePath(jsym.key);

  // JavaScript symbol
  var sym = {
    Path:      path,
    TreePath:  treePath,
    Kind:      kindOfJSGSymbol(jsym),
    Exported:  exported,
    Callable:  isFunc,
  };

  var symData = {
    Kind:          jsKind(jsym),
    Key:           jsym.key,
    jsgSymbolData: jsym.data,
    Type:          jsym.type,
    IsFunc:        isFunc,
  };
  sym.Data = symData;

  if (symData.Kind == "amd-module" || symData.Kind == "commonjs-module") {
    // File
    var moduleFile = jsym.key.module;
    var moduleName = jsym.key.module.replace(/\.js$/, "");
    sym.Name = moduleName;
    sym.File = moduleFile;
    sym.DefStart = 0;
    sym.DefEnd = 0; // TODO(sqs): get filesize
    sym.Exported = true
  } else {
    sym.Name = lastScopePathComponent(jsym.key.path)
    sym.File = jsym.file

    if (jsym.defn) {
      var defnSpan = parseSpan(jsym.defn);
      sym.DefStart = defnSpan[0];
      sym.DefEnd = defnSpan[1];
    }
  }

  // HACK TODO(sqs): some avals have an origin in this project but a file
  // outside of it, and they refer to defs outside of this project. but
  // because the origin is in this project, they get emitted as symbols in
  // this project. fix this in jsg dump.js (most likely).
  if (strContains(sym.Path, "/node_core_modules/")) {
    console.error("skipping symbol key path in node_core_modules:", sym.Path);
    return;
  }

  if (jsym.doc) {
    out.Docs.push({
      Path:      sym.Path,
      Format:    "",
      Data:      jsym.doc.trim().replace(/^\* /, ''),
    })
  }

  // TODO(sqs): implement propgs
  // for _, recv = range jsym.Recv {
  //   srcRepo, srcUnit, srcPath, err = recv.Resolve()
  //   if err == ErrSkipResolve {
  //     continue
  //   }
  //   if err != nil {
  //     return nil, nil, nil, nil, err
  //   }
  //   propgs = append(propgs, &graph.Propagate{
  //     DstPath: sym.Path,
  //     SrcRepo: srcRepo,
  //     SrcUnit: srcUnit,
  //     SrcPath: srcPath,
  //   })
  // }

  out.Symbols.push(sym);

  return out;
}

// strHasPrefix returns whether prefix is a prefix of s.
function strHasPrefix(s, prefix) {
  return s && s.indexOf(prefix) === 0;
}

// strContains returns true if substr is within s.
function strContains(s, substr) {
  return s && s.indexOf(substr) !== -1;
}

// strHasSuffix returns true if s has suffix suffix.
function strHasSuffix(s, suffix) {
  return s && s.indexOf(suffix, s.length - suffix.length) !== -1;
}

// kindOfJSGSymbol returns the "generic" (cross-language) kind of jsym.
function kindOfJSGSymbol(jsym)  {
  var sk = jsKind(jsym);
  switch (sk) {
  case "property":
    return "field";
  case "prototype":
    return "type";
  case "commonjs-module":
  case "amd-module":
    return "module";
  case "npm-package":
    return "package";
  }
  return sk;
}

// jsKind returns the JavaScript-specific kind of jsym.
function jsKind(jsym) {
  if (jsym.data) {
    if (jsym.data.nodejs && jsym.data.nodejs.moduleExports) return "commonjs-module";
    if (jsym.data.amd && jsym.data.amd.module) return "amd-module";
  }
  if (strHasSuffix(jsym.key.path, ".prototype")) return "prototype";
  if (strHasPrefix(jsym.type, "fn(")) return "func";
  if (jsym.key.path.split(".").length > 2) return "property";
  return "var";
}

function lastScopePathComponent(scopePath) {
  var lastDot = scopePath.lastIndexOf(".");
  if (lastDot == -1) return scopePath;
  if (lastDot == scopePath.length - 1) return lastScopePathComponent(scopePath.slice(0,lastDot)) + ".";
  return scopePath.slice(lastDot+1);
}

// parseSpan parses spans like "123-456" to [123,456].
function parseSpan(span) {
  if (!span) return [0,0];
  var parts = span.split("-");
  if (parts.length != 2) throw new Error("parseSpan expects format '123-456'");
  return [parseInt(parts[0]), parseInt(parts[1])];
}

function ErrSkipResolve() {}

// convertRef converts from a jsg ref to a srclib Ref.
function convertRef(jref) {
  try {
    var resolved = resolveTarget(jref.target);
  } catch (e) {
    if (e instanceof ErrSkipResolve) return null;
    throw e;
  }

  var span = parseSpan(jref.span);

  return {
    SymbolRepo:     resolved.repoURL,
    SymbolUnitType: resolved.unitType || "",
    SymbolUnit:     resolved.unit,
    SymbolPath:     resolved.path,
    Def:            jref.def,
    File:           jref.file,
    Start:          span[0],
    End:            span[1],
  }
}

function resolveTarget(t) {
  try {
    var repo = resolveTargetRepository(t);
  } catch (e) {
    if (t.origin == "ecma5" || t.origin == "browser") throw new ErrSkipResolve;
    throw e;
  }

  return {repoURL: repo.repoURL, unit: repo.unit, path: keyToSymbolPath(makeTargetDefPath(t))};
}

function resolveTargetModuleRelativeToNPMPackage(t) {
  // func (t RefTarget) ModuleRelativeToNPMPackage() (string, error) {
  if (!t.npmPackage) throw new Error("not an NPM package: " + JSON.stringify(t));
  return path.relative(t.npmPackage.dir, t.module);
}

function resolveTargetRepository(t) {
  // func (t *RefTarget) Repository() (url string, unit string, vcs repo.VCS, err error) {
  if (t.npmPackage && t.npmPackage.repository) {
    return {repoURL: t.npmPackage.repository.url, name: t.npmPackage.name, repoType: t.npmPackage.repository.type};
  }
  if (t.origin == "node" || t.nodejsCoreModule) {
    return {repoURL: "https://github.com/joyent/node.git", name: "node", repoType: "git"};
  }
  if (!t.abstract) {
    // Current repository
    return {repoURL: "", name: "", repoType: ""};
  }
  throw new Error("couldn't determine target repository: " + JSON.stringify(t));
}

function makeTargetDefPath(t) {
  // func (t *RefTarget) DefPath() (*DefPath, error) {
  var defPathKey = {namespace: t.namespace, module: t.module, path: t.path};
  if (t.origin == "node" || t.namespace == "commonjs") {
    defPathKey.module = defPathKey.module.replace(/\.js$/, '') + ".js";
  }
  if (t.nodejsCoreModule) {
    defPathKey.module = "lib/" + t.nodejsCoreModule + ".js"
  }
  if (t.npmPackage) {
    defPathKey.module = resolveTargetModuleRelativeToNPMPackage(t);
  }
  return defPathKey
}
