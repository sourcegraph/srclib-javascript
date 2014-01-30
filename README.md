# jsg: JavaScript grapher

**jsg** analyzes JavaScript source code and emits a representation of the code
suitable for browsing, documentation generation, or static analysis. The output
consists of all of the code's **symbols** (defined variables, functions, etc.)
and **refs** (a link to the definition symbol of each name that appears in the
source code).

For example, in the code snippet `var A = function() {}; A();`, there is one
symbol (the function `A`) and two refs (both instances of the name `A`, which
both point to the function `A`).

Unlike other JavaScript static analysis tools that only analyze syntax, jsg
performs type inference (using [tern](https://github.com/marijnh/tern)) to more
accurately find definitions and references, and to handle module loading schemes
(such as CommonJS and RequireJS). In particular, jsg is able to resolve
references to code from external dependencies, which would stump a syntactic
analyzer.

**Why?** Having a standard representation for definitions and references in a
codebase makes it easier to build more advanced development tools. Right now,
many editors, linters, style checkers, code search engines, documentation
generators, Grunt tasks, etc., implement their own routines for analyzing source
code. This is inefficient and leads to many partially complete implementations
that work only on specific configurations. The goal of jsg is to provide a
standard way for these tools to analyze source code, and to enable the
development of even smarter tools to further improve JavaScript development.

**Current status:** Alpha. Focus is on improving the source code analysis; tool
integrations are still TODO. jsg is currently in use on
[Sourcegraph](https://sourcegraph.com); see, e.g.,
[joyent/node](https://sourcegraph.com/github.com/joyent/node).

**[Documentation on Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/jsg)**

[![Build Status](https://travis-ci.org/sourcegraph/jsg.png?branch=master)](https://travis-ci.org/sourcegraph/jsg)
[![status](https://sourcegraph.com/api/repos/github.com/sourcegraph/jsg/badges/status.png)](https://sourcegraph.com/github.com/sourcegraph/jsg)
[![authors](https://sourcegraph.com/api/repos/github.com/sourcegraph/jsg/badges/authors.png)](https://sourcegraph.com/github.com/sourcegraph/jsg)


## Usage

To install dependencies, run `npm install`.

Run `bin/jsg` to see usage information and `npm test` to run the test suite.


### Graph a single JavaScript file

In the simplest case, we have one JavaScript file named "simple.js" that uses
only ECMA5 built-ins:

```javascript
// simple.js

// A returns a number
function A() { return 5; }
var b = A();
```

To graph this file, run:

```bash
$ bin/jsg simple.js
```

The output is:

```json
{
    "symbols": [
        {
            "defn": "36-62",
            "doc": "simple.js",
            "exported": true,
            "file": "simple.js",
            "id": "^.A",
            "ident": "45-46",
            "key": {
                "namespace": "global",
                "path": "A"
            },
            "type": "fn() -> number"
        },
        {
            "defn": "67-74",
            "exported": true,
            "file": "simple.js",
            "id": "^.b",
            "ident": "67-68",
            "key": {
                "namespace": "global",
                "path": "b"
            },
            "type": "number"
        }
    ],
    "refs": [
        {
            "file": "simple.js",
            "span": "45-46",
            "target": {
                "abstract": false,
                "namespace": "global",
                "path": "A"
            }
        },
        {
            "file": "simple.js",
            "span": "67-68",
            "target": {
                "abstract": false,
                "namespace": "global",
                "path": "b"
            }
        },
        {
            "file": "simple.js",
            "span": "71-72",
            "target": {
                "abstract": false,
                "namespace": "global",
                "path": "A"
            }
        }
    ]
}
```

The **Schema** section below describes the format of this data.


## Schema

jsg outputs a JSON object with 2 properties: a `symbols` array and a `refs`
array. These 2 concepts are simplified, convenient models of what an actual
JavaScript interpreter would determine at runtime. As jsg development
progresses, we'll almost certainly need to refine these models (and perhaps add
another model of the type system) to support use cases.

### Symbols

A **symbol** is any definition that has a name that can be determined
statically. A name is a named scope entry, or an object property of a definition
with a name. A definition is the explicit assignment of some type or value to a
name, not the result of evaluating that name at runtime.

In plain JavaScript, ignoring rare and ECMA5+ features, you can define names in
a few ways:

1. Variable declarations: `var v;` defines a top-level name `v`
1. Functions declarations: `function f() {}` defines a top-level name `f`
1. Function params: `(function(p) {})` defines a locally scoped name `p`
1. Object properties: `var o = {p: 1};` defines top-level names `o` and `o.p`

Only explicit assignments are considered to be definitions. For example, the
code `var o1 = {}, o2 = o1; o1.p = 7;` contains only 3 definitions: `o1`, `o2`,
and `o1.p`. There is no definition named `o2.p` because it was never explicitly
and statically assigned, even though at runtime that expression is defined. That
relationship between `o2.p` and `o1.p` is encoded as a ref from the character
offsets containing the `p` in `o2.p` to the definition at `o1.p` (see below for
more about refs).


#### Namespaces and globally addressable names

It's useful to give each definition a globally addressable name, like a URI to
that definition. This makes it possible to have a flat namespace with a single
unique identifier for each definition, instead of having to maintain the
original hierarchical structure of the program's scopes.

For global variables and function declarations, determining the global name is
simple: it's just the name of the variable or function. For object properties
thereof, we just walk the key path to access the definition (so `var o = {p: {q:
1}};` yields `o.p.q`). These global names have the nice property that evaluating
them at runtime yields their runtime definition, because this naming scheme
corresponds perfectly with JavaScript's.

**Locals:** How do you create a globally addressable name for a variable in
a local scope? We must synthesize a unique, globally addressable name for each
local scope, and then place that scope's variables underneath that namespace.

For example, consider this code:

```javascript
function A() {
  var b;
}
```

As a convention, we say that the name of a function's scope is the function's
name plus `.$local`. (Ignore, for now, the possibility of the function having an
object property `$local`. That's easy to work around.) So our synthesized
globally addressable name for `b` is `A.$local.b`. For anonymous functions, we
can synthesize a name based on the character position of their
FunctionExpression AST node.

**Module systems:** A module is basically a named definition, but the name is
specified using a scheme specific to the module loader. Also, there are often
many different names that resolve to the same module. So we must synthesize one
globally addressable name for each module, and in doing so resolve the many
possible names to one canonical name.

For example, in CommonJS (used by Node.js), modules are retrieved using the
[`require()`](https://sourcegraph.com/github.com/joyent/node/symbols/javascript/commonjs/lib/module.js/-/prototype/require)
function). The same module can be retrieved using any valid filesystem path to
the file (with or without `.js)` or its containing directory (if it's the main
file of a package), or using abstract paths that are resolved using
`node_modules` directories. The convention that jsg uses for CommonJS names is
`!node.` plus the relative file path to the module.


### Refs

TODO


## Authors

Contributions are welcome! Submit a GitHub issue or pull request.

* [Quinn Slack (sqs)](https://sourcegraph.com/sqs)
