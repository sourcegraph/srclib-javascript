# tern-def-origin

A [tern](http://ternjs.net) plugin for determining the definition AST node and
origin for JavaScript types.


**[Documentation on Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/tern-def-origin)**

[![Build Status](https://travis-ci.org/sourcegraph/tern-def-origin.png?branch=master)](https://travis-ci.org/sourcegraph/tern-def-origin)
[![status](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-def-origin/badges/status.png)](https://sourcegraph.com/github.com/sourcegraph/tern-def-origin)
[![authors](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-def-origin/badges/authors.png)](https://sourcegraph.com/github.com/sourcegraph/tern-def-origin)
[![Total views](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-def-origin/counters/views.png)](https://sourcegraph.com/github.com/sourcegraph/tern-def-origin)


## Usage

To install dependencies, run `npm install`.

This plugin requires tern 0.5.1 (which sets the `sourceFile` property on AST nodes).


### With the tern server

Add this plugin to your `.tern-project` file:

```json
{
  "plugins": {"/path/to/def-origin.js": {}}
}
```

### With the tern condenser

Load the plugin:

```bash
$ node_modules/tern/bin/condense --plugin def-origin testdata/simple.js
```

You'll see the new `!data.aval` and !data.type` key paths on types in the
condensed output:

```json
{
  "!name": "testdata/simple.js",
  "a": {
    "!type": "fn()",
    "!span": "4[0:4]-5[0:5]",
    "!data": {
      "aval": {
        "originFile": "testdata/simple.js",
        "identSpan": "4-5",
        "defSpan": "8-21"
      },
      "type": {
        "origin": "testdata/simple.js",
        "name": "a"
      }
    }
  },
  "b": {
    "!type": "number",
    "!span": "27[1:4]-28[1:5]",
    "!data": {
      "aval": {
        "originFile": "testdata/simple.js",
        "identSpan": "46-47",
        "defSpan": "49-50"
      },
      "type": {
        "name": "number"
      }
    }
  },
  "c": {
    "d": {
      "!type": "number",
      "!span": "46[3:2]-47[3:3]",
      "!data": {
        "aval": {
          "originFile": "testdata/simple.js",
          "identSpan": "46-47",
          "defSpan": "49-50"
        },
        "type": {
          "name": "number"
        }
      }
    },
    "f": {
      "!type": "fn()",
      "!span": "54[4:2]-55[4:3]",
      "!data": {
        "aval": {
          "originFile": "testdata/simple.js",
          "identSpan": "54-55",
          "defSpan": "57-70"
        },
        "type": {
          "origin": "testdata/simple.js",
          "name": "f"
        }
      }
    },
    "!span": "38[2:4]-39[2:5]",
    "!data": {
      "aval": {
        "originFile": "testdata/simple.js",
        "identSpan": "38-39",
        "defSpan": "42-73"
      },
      "type": {
        "origin": "testdata/simple.js",
        "name": "c"
      }
    }
  },
  "g": {
    "!type": "fn()",
    "!span": "85[7:9]-86[7:10]",
    "!data": {
      "aval": {
        "originFile": "testdata/simple.js",
        "identSpan": "85-86",
        "defSpan": "76-91"
      },
      "type": {
        "origin": "testdata/simple.js",
        "name": "g"
      }
    }
  },
  "e": "Array"
}
```


## Running tests

Run `npm test`.


## Authors

Contributions are welcome! Submit a GitHub issue or pull request.

* [Quinn Slack (sqs)](https://sourcegraph.com/sqs)
