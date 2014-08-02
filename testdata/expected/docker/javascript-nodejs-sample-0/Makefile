all: .srclib-cache/9fa3409fcc5d2a3f3166eefb06882cb838a7a410/sourcegraph-nodejs-sample/CommonJSPackage.graph.json .srclib-cache/9fa3409fcc5d2a3f3166eefb06882cb838a7a410/sourcegraph-nodejs-sample/CommonJSPackage.depresolve.json

.srclib-cache/9fa3409fcc5d2a3f3166eefb06882cb838a7a410/sourcegraph-nodejs-sample/CommonJSPackage.graph.json: .srclib-cache/9fa3409fcc5d2a3f3166eefb06882cb838a7a410/sourcegraph-nodejs-sample/CommonJSPackage.unit.json animal.js test/animal_test.js
	src tool --methods docker "sourcegraph.com/sourcegraph/srclib-javascript" "graph" < $^ | src internal normalize-graph-data 1> $@

.srclib-cache/9fa3409fcc5d2a3f3166eefb06882cb838a7a410/sourcegraph-nodejs-sample/CommonJSPackage.depresolve.json: .srclib-cache/9fa3409fcc5d2a3f3166eefb06882cb838a7a410/sourcegraph-nodejs-sample/CommonJSPackage.unit.json
	src tool --methods docker "sourcegraph.com/sourcegraph/srclib-javascript" "depresolve" < $^ 1> $@

.DELETE_ON_ERROR:
