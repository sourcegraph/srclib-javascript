.srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.depresolve.json: .srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.unit.v0.json
	src tool -m docker "github.com/sourcegraph/srclib-javascript" "depresolve" < $^  1> $@

.srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.graph.json: .srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.unit.v0.json
	src tool -m docker "github.com/sourcegraph/srclib-javascript" "graph" < $^ | src internal normalize-graph-data 1> $@

all: .srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.depresolve.json .srclib-cache/c0a3957fb0d9b205920b446c9f302936fb34f909/javascript-nodejs-xrefs-0/CommonJSPackage.graph.json

.DELETE_ON_ERROR:
