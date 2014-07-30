var async = require('async'), execFile = require('child_process').execFile, fs = require('fs'), xml2js = require('xml2js'), path = require('path');

exports.listDocEntriesSync = function(apiDocDir) {
  var entriesDir = 'entries';
  var files = fs.readdirSync(path.join(apiDocDir, entriesDir));
  return files.filter(function(f) { return /\.xml$/.test(f); }).map(function(f) { return path.join(apiDocDir, entriesDir, f); }).sort();
};

exports.generateDoc = function(xmlDocFile, xslFile, xsltproc, cb) {
  // We use 2 approaches to getting info out of the jQuery doc XML files:
  // parsing the XML to JSON, and running the XML through an XSL stylesheet.
  // Both outputs are useful: the JSON gets us programmatically accessible
  // metadata, and the XSL stylesheet lets us present the docs visually.
  var docObj = exports.parseDocXMLSync(xmlDocFile);
  exports.generateDocHTML(xmlDocFile, xslFile, xsltproc, function(err, html) {
    cb(err, {html: html, parsed: docObj});
  });
};

exports.generateDocHTML = function(xmlDocFile, xslFile, xsltproc, cb) {
  var opts = {maxBuffer: 2000*1024};
  execFile(xsltproc || 'xsltproc', [xslFile, xmlDocFile], opts, function(err, stdout, stderr) {
    if (err) return cb(err);
    cb(null, stdout);
  });
};

exports.parseDocXMLSync = function(xmlDocFile) {
  if (!fs.existsSync(xmlDocFile)) throw new Error('no such file: ' + xmlDocFile);
  var parser = new xml2js.Parser({async: false, explicitArray: true});
  var docXML = fs.readFileSync(xmlDocFile);
  if (!docXML) throw new Error('error reading file: ' + xmlDocFile);
  var docEntries;
  parser.parseString(docXML, function(err, res) {
    if (err) throw err;
    var entries, commonDesc = '';
    if (res.entries) {
      // Only take the first entry, if there are multiple. In api.jquery.com git
      // commit 75a361341075280453582ef22b7f75d4ea1c976c, the only XML file with
      // multiple entries is jQuery.xml. Thus we are throwing out the 2 less
      // commonly used variants of the jQuery()/$() function that are documented
      // in that file.
      entries = res.entries.entry.slice(0, 1);
      if (res.entries.desc) commonDesc = res.entries.desc[0];
    } else {
      entries = [res.entry];
    }
    docEntries = entries.map(function(e) {
      doc = {
        type: e.$.type,
        name: e.$.name,
        title: e.title ? e.title[0] : e.$.name,
        returnType: e.$['return'],
        signatures: e.signature.map(function(s) {
          var sig = {};
          if (s.added) sig.added = s.added[0];
          if (s.argument) sig.args = s.argument.map(function(a) {
              // Omit desc tag because it contains HTML, which confuses xml2js.
              return {name: a.$.name, type: a.$.type};
          });
          return sig;
        }),
        // Omit longDesc tag because it contains HTML, which confuses xml2js.
        categories: e.category.map(function(c) { return c.$.slug; }),
      };
      if (e.desc[0]) {
        // Work around xml2js's auto-parsing of HTML in the <desc> to get a
        // string. If there are tags in the <desc>, the docstring will be missing
        // some text. TODO(sqs): fix this - get all of the docstring.
        if (typeof e.desc[0] != 'string') e.desc[0] = e.desc[0]._;
        if (e.desc[0].slice(0, 50) == commonDesc.slice(0, 50)) {
          doc.desc = e.desc[0];
        } else {
          doc.desc = (commonDesc ? commonDesc + ' ' : '') + e.desc[0];
        }
      } else if (commonDesc) {
        doc.desc = commonDesc;
      }
    });
  });
  return doc;
};

exports.generateAllDocs = function(apiDocDir, xslFile, xsltproc, cb) {
  var entryFiles = exports.listDocEntriesSync(apiDocDir);
  var docEntries = [];

  var q = async.queue(function(task, cb) {
    exports.generateDoc(task.entryFile, xslFile, xsltproc, function(err, doc) {
      if (err) return cb(err);
      doc.docSourceFile = task.entryFile;
      docEntries.push(doc);
      cb(null);
    });
  }, 5);
  q.drain = function() {
    cb(null, {entries: docEntries});
  };
  entryFiles.forEach(function(entryFile) {
    q.push({entryFile: entryFile}, function(err) {
      if (err) throw err;
    });
  });
};

var tern = require('tern');
tern.registerPlugin('jquery-api-doc', function(server, options) {
  function isJQuerySourceFile(file) {
    if (!file) return false;
    var apiSrcDir = path.resolve(options.apiSrcDir);
    var absFile = path.resolve(file);
    return absFile.indexOf(apiSrcDir + '/') == 0;
  }

  var docs;

  // Set server async and wrap getFile so that we can run an asynchronous
  // operation (generateAllDocs). (This is hacky.)
  var docGenStarted;
  var origGetFile0 = server.options.getFile, origGetFile = server.options.getFile;
  if (!server.options.async) origGetFile = function(filename, cb) {
    try {
      var data = origGetFile0(filename);
      cb(null, data);
    } catch (e) {
      cb(e);
    }
  };
  server.options.async = true;
  server.options.fetchTimeout = 25000;
  server.options.getFile = function(filename, cb) {
    // Only trigger generation of all jQuery docs if we've loaded a jQuery
    // source file.
    if (isJQuerySourceFile(filename) && !docGenStarted) {
      docGenStarted = true;
      exports.generateAllDocs(options.apiDocDir, options.xslFile, options.xsltproc, function(err, _docs) {
        if (err) throw err;
        docs = _docs;
        origGetFile(filename, cb);
      });
    } else origGetFile(filename, cb);
  };
  // Also hack addFile so that bin/condense can't bypass our getFile hack
  // (above) by providing the file contents as the 2nd param ("text").
  var origAddFile = server.addFile;
  server.addFile = function(filename) { origAddFile.apply(server, [filename]); };

  return {
    passes: {
      preCondenseReach: function(state) {
        if (!docs) {
          // No jQuery source files were added, so there's nothing to do here.
          return;
        }
        // Find the jQuery "src/core" AMD module. All definitions are underneath
        // that module.
        var ifaces = state.cx.parent._requireJS.interfaces;
        var srcCoreModuleName = Object.keys(ifaces).filter(function(m) {
          return /src\/core$/.test(m);
        })[0];
        if (!srcCoreModuleName) {
          throw new Error("Couldn't find the jQuery src/core module. All modules: " + JSON.stringify(Object.keys(ifaces)));
        }

        var jQueryModule = ifaces[srcCoreModuleName];
        var jQueryType = jQueryModule.getType();

        // Compute the scope paths for each doc entry.
        docs.entries.forEach(function(e) {
          var p = e.parsed;
          if (p.name == 'jQuery') {
            // Only attach the docs of the $(selector, context) method, not the
            // $(htmlString) or $(readyFunc) methods. Ignore the others
            // (TODO(sqs): how can we present those?).
            var args = p.signatures[0].args;
            if (args[0].name == 'selector' && args[1].name == 'context') {
              e._path = 'fn.constructor';
            }
          } else if (p.type == 'method' || p.type == 'property') {
            // Determine whether this a prototype/jQuery.fn method (like `add`
            // in $(foo).add(...)) or a top-level/"class" method (like `ajax` in
            // $.ajax(...))?
            var isJQueryFnMethod = p.name.indexOf('jQuery.') == -1;
            if (isJQueryFnMethod) e._path = 'fn.' + p.name;
            else e._path = p.name;
          }
        });

        docs.entries.forEach(function(e) {
          if (!e._path) return;

          // Get the property denoted by the key path.
          var parts = e._path.split('.');
          var obj = jQueryModule.getProp(parts[0]).getType();
          if (!obj) {
            console.error("No jQuery definition found at path " + JSON.stringify(e._path));
            return;
          }
          if (parts.length == 2) obj = obj.getProp(parts[1]);
          if (!obj) {
            console.error("No jQuery definition found at path " + JSON.stringify(e._path));
            return;
          }
          obj.doc = options.html ? e.html : e.parsed.desc;
        });
      },
    },
  };
});
