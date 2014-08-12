.PHONY: test-deps test

test-deps:
	git submodule init
	git submodule update
	cd testdata/case/javascript-nodejs-xrefs-0 && npm install --ignore-scripts
	cd testdata/case/javascript-nodejs-sample-0 && npm install --ignore-scripts

test: test-deps
	npm test
