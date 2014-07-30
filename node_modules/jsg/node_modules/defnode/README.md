defnode
=======

[![xrefs](https://sourcegraph.com/api/repos/github.com/sourcegraph/defnode.js/badges/xrefs.png)](https://sourcegraph.com/github.com/sourcegraph/defnode.js)
[![funcs](https://sourcegraph.com/api/repos/github.com/sourcegraph/defnode.js/badges/funcs.png)](https://sourcegraph.com/github.com/sourcegraph/defnode.js)
[![top func](https://sourcegraph.com/api/repos/github.com/sourcegraph/defnode.js/badges/top-func.png)](https://sourcegraph.com/github.com/sourcegraph/defnode.js)
[![library users](https://sourcegraph.com/api/repos/github.com/sourcegraph/defnode.js/badges/library-users.png)](https://sourcegraph.com/github.com/sourcegraph/defnode.js)
[![status](https://sourcegraph.com/api/repos/github.com/sourcegraph/defnode.js/badges/status.png)](https://sourcegraph.com/github.com/sourcegraph/defnode.js)

defnode is a node.js package that maps JavaScript Identifier AST nodes to/from
their corresponding definition nodes. It is useful in tools that perform
JavaScript source introspection.

For example, suppose we have the following code.

```javascript
function a(b) {
  var c = 1, d;
}
```

defnode maps the following Identifier/definition pairs:

* `a` to/from the enclosing FunctionDeclaration node
* `b` to/from itself (since its Identifier node is its own declaration)
* `c` to/from its VariableDeclarator node
* `d` to/from its VariableDeclarator node

defnode uses [marijnh/tern](https://github.com/marijnh/tern), but it should
work with any [SpiderMonkey
API](https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API)-compliant
JavaScript AST.

Documentation: [defnode.js on Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/defnode.js)


Running tests
=============

Run `npm test`.


Contributors
============

* Quinn Slack <sqs@sourcegraph.com>
