.srclib-cache/0d879f60b2178b86499e945681ac7ac0563ba24f/sourcegraph-nodejs-sample/CommonJSPackage.graph.json: .srclib-cache/0d879f60b2178b86499e945681ac7ac0563ba24f/sourcegraph-nodejs-sample/CommonJSPackage.unit.v0.json
	src tool -m docker "github.com/sourcegraph/srclib-javascript" "graph" < $^ | src internal normalize-graph-data 1> $@

.srclib-cache/0d879f60b2178b86499e945681ac7ac0563ba24f/sourcegraph-nodejs-sample/CommonJSPackage.depresolve.json: .srclib-cache/0d879f60b2178b86499e945681ac7ac0563ba24f/sourcegraph-nodejs-sample/CommonJSPackage.unit.v0.json
	src tool -m docker "github.com/sourcegraph/srclib-javascript" "depresolve" < $^  1> $@

all: .srclib-cache/0d879f60b2178b86499e945681ac7ac0563ba24f/sourcegraph-nodejs-sample/CommonJSPackage.graph.json .srclib-cache/0d879f60b2178b86499e945681ac7ac0563ba24f/sourcegraph-nodejs-sample/CommonJSPackage.depresolve.json

.DELETE_ON_ERROR:
