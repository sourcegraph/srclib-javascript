require('acorn-jsx');

var tern = require('tern');
var infer = require('tern/lib/infer');
var walk = require('acorn/dist/walk');

tern.registerPlugin("reactjs", function (server) {
    server.on("preParse", function (text, options) {
        var plugins = options.plugins || {};
        plugins.jsx = true;
        options.plugins = plugins;
    });
    walk.base.JSXElement = function (node, state, cb) {
        node.children.forEach(function (n) {
            cb(n, state);
        });
    };
    walk.base.JSXExpressionContainer = function (node, state, cb) {
        if (node.expression.type != "JSXEmptyExpression") {
            cb(node.expression, state);
        }
    };
    infer.typeFinder.JSXElement = function (node, scope) {
        return scope.hasProp(node.openingElement.name.name) || infer.ANull;
    };
    infer.scopeGatherer.JSXElement = function () {
    };
    infer.inferWrapper.JSXElement = function () {
    };
    infer.searchVisitor.JSXElement = function (node, scope, callback) {
        node.children.forEach(function (child) {
            callback(child, scope);
        });
    };
    server.addDefs(defs);
});

var defs = {
    "!name": "react",
    "!define": {
        "ComponentSpecs": {
            "!doc": "When creating a component class by invoking React.createClass(), you should provide a specification object that contains a render method and can optionally contain other lifecycle methods described here.",
            "!url": "https://facebook.github.io/react/docs/component-specs.html#component-specifications",
            "render": {
                "!type": "fn()"
            }
        },
        "ReactClass": {},
        "ReactElement": {}
    },
    "React": {
        "!doc": "React is the entry point to the React library. If you're using one of the prebuilt packages it's available as a global; if you're using CommonJS modules you can require() it.",
        "!url": "https://facebook.github.io/react/docs/top-level-api.html#react",
        "Component": {
            "!doc": "This is the base class for React Components when they're defined using ES6 classes. See Reusable Components for how to use ES6 classes with React. For what methods are actually provided by the base class, see the Component API.",
            "!url": "https://facebook.github.io/react/docs/top-level-api.html#react.component"
        },
        "createClass": {
            "!type": "fn(specification: +ComponentSpecs) -> +ReactClass",
            "!doc": "Create a component class, given a specification. A component implements a render method which returns one single child. That child may have an arbitrarily deep child structure. One thing that makes components different than standard prototypal classes is that you don't need to call new on them. They are convenience wrappers that construct backing instances (via new) for you.",
            "!url": "https://facebook.github.io/react/docs/top-level-api.html#react.createclass"
        },
        "createElement": {
            "!type": "fn(type: string|+ReactClass, props?: ?, children?: []) -> +ReactElement",
            "!doc": "Create and return a new ReactElement of the given type. The type argument can be either an html tag name string (eg. 'div', 'span', etc), or a ReactClass (created via React.createClass).",
            "!url": "https://facebook.github.io/react/docs/top-level-api.html#react.createelement"
        },
        "cloneElement": {
            "!type": "fn(element: +ReactElement, props?: ?, children?: []) -> +ReactElement",
            "!doc": "Clone and return a new ReactElement using element as the starting point. The resulting element will have the original element's props with the new props merged in shallowly. New children will replace existing children. Unlike React.addons.cloneWithProps, key and ref from the original element will be preserved. There is no special behavior for merging any props (unlike cloneWithProps). See the v0.13 RC2 blog post for additional details.",
            "!url": "https://facebook.github.io/react/docs/top-level-api.html#react.cloneelement"
        },
        "createFactory": {
            "!type": "fn(type: string|+ReactClass) -> fn() -> +ReactElement",
            "!doc": "Return a function that produces ReactElements of a given type. Like React.createElement, the type argument can be either an html tag name string (eg. 'div', 'span', etc), or a ReactClass.",
            "!url": "https://facebook.github.io/react/docs/top-level-api.html#react.createfactory"
        },
        "isValidElement": {
            "!type": "fn(object: ?) -> fn() -> bool",
            "!doc": "Verifies the object is a ReactElement.",
            "!url": "https://facebook.github.io/react/docs/top-level-api.html#react.isvalidelement"
        },
        "DOM": {
            "!doc": "React.DOM provides convenience wrappers around React.createElement for DOM components. These should only be used when not using JSX. For example, React.DOM.div(null, 'Hello World!')",
            "!url": "https://facebook.github.io/react/docs/top-level-api.html#react.dom"
        }
    }
};
