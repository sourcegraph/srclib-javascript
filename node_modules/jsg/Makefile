.PHONY: rm_other_terns npm-install

dep: npm-install rm_other_terns

npm-install:
	npm install

rm_other_terns:
	find node_modules/ -name tern | grep -v '^node_modules/tern$$' | xargs rm -rf
