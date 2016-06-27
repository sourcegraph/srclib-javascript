require('acorn-jsx');

var tern = require('tern');
var infer = require('tern/lib/infer');
var walk = require('acorn/dist/walk');

tern.registerPlugin("reactjs", function(server) {
	server.on("preParse", function(text, options) {
		var plugins = options.plugins || {};
		plugins.jsx = true;
		options.plugins = plugins;
	});
	walk.base.JSXElement = function(node, state, cb) {
		node.children.forEach(function (n) {
       		cb(n, state);
     	});
	};
	walk.base.JSXExpressionContainer = function(node, state, cb) {
		if (node.expression.type != "JSXEmptyExpression") {
            cb(node.expression, state);
        }
	};
    infer.typeFinder.JSXElement = function(node, scope) {
        return scope.hasProp(node.openingElement.name.name) || infer.ANull;
    };
    infer.scopeGatherer.JSXElement = function() {
    };
    infer.inferWrapper.JSXElement = function() {
    };
    infer.searchVisitor.JSXElement = function(node, scope, callback) {
        node.children.forEach(function(child) {
            callback(child, scope);
        });
    };
});
