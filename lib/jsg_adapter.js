var execFile = require("child_process").execFile;
var path = require("path");

// run jsg on srcunit (a CommonJSPackage), calling cb(err, graphData).
module.exports.run = function(dir, srcunit, cb) {
  var args = [path.join(__dirname, "../node_modules/jsg/bin/jsg")];

  // add plugins from the source unit config
  if (srcunit.Config && srcunit.Config.jsg && srcunit.Config.jsg.plugins) {
    Object.keys(srcunit.Config.jsg.plugins).forEach(function(pluginName) {
      var opts = srcunit.Config.jsg.plugins[pluginName];

      // perform variable substitutions
      // TODO(sqs): document these
      var substs = {"JSG_DIR": path.join(__dirname, "../node_modules/jsg")};
      Object.keys(substs).forEach(function(varName) {
        pluginName = pluginName.replace("$(" + varName + ")", substs[varName]);
        if (pluginName == "node" && opts.coreModulesDir) {
          opts.coreModulesDir = opts.coreModulesDir.replace("$(" + varName + ")", substs[varName]);
        }
      });

      args.push("--plugin", pluginName+"="+JSON.stringify(opts));
    });
  }

  srcunit.Files.forEach(function(f) {
    args.push(path.join(dir, f));
  });

  console.error("Exec: ", args);
  execFile(process.execPath /* node */, args, {maxBuffer: 250*1024*1024}, function(err, stdout, stderr) {
    if (stderr) console.error(stderr);
    if (err) {
      cb(err, null);
      return;
    }

    console.error("Converting to srclib format...");
    var jsgData = JSON.parse(stdout);

    var graphData = convertJSGData(jsgData);

    cb(null, graphData);
  });
};

// convertJSGData converts from jsg output format to srclib output format.
function convertJSGData(data) {
  var out = {
    Defs: [],
    Refs: [],
    Docs: [],
    Propg: [], // TODO(sqs): add propg support, and check that this is the right field name
  };

  data.symbols.forEach(function(jdef) {
    var defData = convertDef(jdef);
    if (defData) {
      out.Defs.push.apply(out.Defs, defData.Defs);
      out.Refs.push.apply(out.Refs, defData.Refs);
      out.Propg.push.apply(out.Propg, defData.Propgs);
      out.Docs.push.apply(out.Docs, defData.Docs);
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

// keyToDefPath converts from a jsg key to a srclib def path.
function keyToDefPath(key) {
  key.path = JSON.stringify(key.path).slice(1,-1); // escape string
  if (!key.module) return [key.namespace, "-", key.path].join("/");
  if (!key.path) return [key.namespace, key.module].join("/");
  return [key.namespace, key.module, "-", key.path.replace(/\./g, "/")].join("/");
}

// TODO implement
function keyToDefTreePath(key) {
  key.path = key.path.replace(/\/\//g, "/"); // hack so we don't break on paths containing "//"
  key.path = JSON.stringify(key.path).slice(1,-1); // escape string

  var namespaceComponents = key.namespace.split("/").map(function(c) { return "-" + c; });
  var ghostedNamespace = namespaceComponents.join("/");

  if (!key.module) return [ghostedNamespace, "-", key.path].join("/");
  if (!key.path) return [ghostedNamespace, key.module].join("/");
  return [ghostedNamespace, key.module, "-", key.path.replace(/\./g, "/").replace(/\/\//g, "/")].join("/");
}

// convertDef returns an object {Defs: [...], Refs: [...], Docs: [...],
// Propg: [...]} whose map value arrays should be appended to the whole output
// (convertJSGData "out").
function convertDef(jdef) {
  var out = {
    Defs: [],
    Refs: [],
    Docs: [],
    Propg: [], // TODO(sqs): add propg support, and check that this is the right field name
  };

  // unexported if it has (or is underneath) a name prefixed with "_" or that
  // contains "<i>" (the array element marker)
  var exported = jdef.exported && !strHasPrefix(jdef.key.path, "_") && !strContains(jdef.key.path, "._") && !strContains(jdef.key.path, "<i>");

  var isFunc = strHasPrefix(jdef.type, "fn(");
  var path = keyToDefPath(jdef.key);
  var treePath = keyToDefTreePath(jdef.key);

  // JavaScript def
  var def = {
    Path:      path,
    TreePath:  treePath,
    Kind:      kindOfJSGDef(jdef),
    Exported:  exported,
    Callable:  isFunc,
  };

  var defData = {
    Kind:          jsKind(jdef),
    Key:           jdef.key,
    jsgDefData: jdef.data,
    Type:          jdef.type,
    IsFunc:        isFunc,
  };
  def.Data = defData;

  if (defData.Kind == "amd-module" || defData.Kind == "commonjs-module") {
    // File
    var moduleFile = jdef.key.module;
    var moduleName = jdef.key.module.replace(/\.js$/, "");
    def.Name = moduleName;
    def.File = moduleFile;
    def.DefStart = 0;
    def.DefEnd = 0; // TODO(sqs): get filesize
    def.Exported = true
  } else {
    def.Name = lastScopePathComponent(jdef.key.path)
    def.File = jdef.file

    if (jdef.defn) {
      var defnSpan = parseSpan(jdef.defn);
      def.DefStart = defnSpan[0];
      def.DefEnd = defnSpan[1];
    }
  }

  // HACK TODO(sqs): some avals have an origin in this project but a file
  // outside of it, and they refer to defs outside of this project. but
  // because the origin is in this project, they get emitted as defs in
  // this project. fix this in jsg dump.js (most likely).
  if (strContains(def.Path, "/node_core_modules/")) {
    console.error("skipping def key path in node_core_modules:", def.Path);
    return;
  }

  if (jdef.doc) {
    out.Docs.push({
      Path:      def.Path,
      Format:    "",
      Data:      jdef.doc.trim().replace(/^\* /, ''),
    })
  }

  // TODO(sqs): implement propgs
  // for _, recv = range jdef.Recv {
  //   srcRepo, srcUnit, srcPath, err = recv.Resolve()
  //   if err == ErrSkipResolve {
  //     continue
  //   }
  //   if err != nil {
  //     return nil, nil, nil, nil, err
  //   }
  //   propgs = append(propgs, &graph.Propagate{
  //     DstPath: def.Path,
  //     SrcRepo: srcRepo,
  //     SrcUnit: srcUnit,
  //     SrcPath: srcPath,
  //   })
  // }

  out.Defs.push(def);

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

// kindOfJSGDef returns the "generic" (cross-language) kind of jdef.
function kindOfJSGDef(jdef)  {
  var sk = jsKind(jdef);
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

// jsKind returns the JavaScript-specific kind of jdef.
function jsKind(jdef) {
  if (jdef.data) {
    if (jdef.data.nodejs && jdef.data.nodejs.moduleExports) return "commonjs-module";
    if (jdef.data.amd && jdef.data.amd.module) return "amd-module";
  }
  if (strHasSuffix(jdef.key.path, ".prototype")) return "prototype";
  if (strHasPrefix(jdef.type, "fn(")) return "func";
  if (jdef.key.path.split(".").length > 2) return "property";
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
    DefRepo:     resolved.repoURL,
    DefUnitType: resolved.unitType || "",
    DefUnit:     resolved.unit,
    DefPath:     resolved.path,
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

  return {repoURL: repo.repoURL, unit: repo.unit, path: keyToDefPath(makeTargetDefPath(t))};
}

function resolveTargetModuleRelativeToNPMPackage(t) {
  // func (t RefTarget) ModuleRelativeToNPMPackage() (string, error) {
  if (!t.npmPackage) throw new Error("not an NPM package: " + JSON.stringify(t));
  return path.relative(t.npmPackage.dir, t.module);
}

function resolveTargetRepository(t) {
  // func (t *RefTarget) Repository() (url string, unit string, vcs repo.VCS, err error) {
  if (t.npmPackage && t.npmPackage.repository) {
    return {repoURL: t.npmPackage.repository.url, unit: t.npmPackage.name, repoType: t.npmPackage.repository.type};
  }
  if (t.origin == "node" || t.nodejsCoreModule) {
    return {repoURL: "https://github.com/joyent/node.git", unit: "node", repoType: "git"};
  }
  if (!t.abstract) {
    // Current repository
    return {repoURL: "", unit: "", repoType: ""};
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
