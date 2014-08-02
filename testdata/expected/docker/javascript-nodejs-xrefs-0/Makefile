all: .srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.graph.json .srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.depresolve.json

.srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.graph.json: .srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.unit.json lib/async.js lib/fs.js lib/glob.js lib/http.js lib/lodash.js lib/minimatch.js lib/mysql.js lib/pg.js lib/read-package-json.js lib/underscore.js index.js
	src tool --methods docker "sourcegraph.com/sourcegraph/srclib-javascript" "graph" < $^ | src internal normalize-graph-data 1> $@

.srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.depresolve.json: .srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.unit.json
	src tool --methods docker "sourcegraph.com/sourcegraph/srclib-javascript" "depresolve" < $^ 1> $@

.DELETE_ON_ERROR:
