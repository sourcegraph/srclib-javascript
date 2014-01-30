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

Run `bin/jsg` to see usage information.


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
    ],
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
    ]
}
```


## Running tests

Run `npm test`.


## Authors

Contributions are welcome! Submit a GitHub issue or pull request.

* [Quinn Slack (sqs)](https://sourcegraph.com/sqs)
