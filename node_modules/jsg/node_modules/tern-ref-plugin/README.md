# tern-ref-plugin

A [tern](http://ternjs.net) plugin that augments condenser output with
information about identifiers and the types they reference.

**[Documentation on Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/tern-ref-plugin)**

[![Build Status](https://travis-ci.org/sourcegraph/tern-ref-plugin.png?branch=master)](https://travis-ci.org/sourcegraph/tern-ref-plugin)
[![status](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-ref-plugin/badges/status.png)](https://sourcegraph.com/github.com/sourcegraph/tern-ref-plugin)
[![authors](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-ref-plugin/badges/authors.png)](https://sourcegraph.com/github.com/sourcegraph/tern-ref-plugin)
[![Total views](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-ref-plugin/counters/views.png)](https://sourcegraph.com/github.com/sourcegraph/tern-ref-plugin)


## Usage

To install dependencies, run `npm install`.


### With the tern condenser

Load the plugin:

```bash
$ node_modules/tern/bin/condense --plugin ref testdata/simple.js
```

You'll see information about identifier node references in the condense output:

```json
{
  "!name": "testdata/simple.js",
  "a": {
    "!type": "number",
    "!span": "testdata/simple.js@4[0:4]-5[0:5]"
  },
  "b": {
    "c": {
      "d": {
        "!type": "number",
        "!span": "testdata/simple.js@28[3:13]-29[3:14]"
      },
      "!span": "testdata/simple.js@24[3:9]-25[3:10]"
    },
    "!span": "testdata/simple.js@19[3:4]-20[3:5]"
  },
  "E": {
    "h": {
      "!type": "number",
      "!span": "testdata/simple.js@131[18:2]-132[18:3]"
    },
    "!type": "fn(f: ?) -> !0",
    "!span": "testdata/simple.js@89[12:9]-90[12:10]"
  },
  "!ref": [
    {
      "file": "testdata/simple.js",
      "start": 4,
      "end": 5,
      "target": {
        "path": "a",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 11,
      "end": 12,
      "target": {
        "path": "a",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 19,
      "end": 20,
      "target": {
        "path": "b",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 24,
      "end": 25,
      "target": {
        "path": "b.c",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 28,
      "end": 29,
      "target": {
        "path": "b.c.d",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 31,
      "end": 32,
      "target": {
        "path": "a",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 36,
      "end": 37,
      "target": {
        "path": "b",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 38,
      "end": 39,
      "target": {
        "path": "b.c",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 41,
      "end": 42,
      "target": {
        "path": "b",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 49,
      "end": 50,
      "target": {
        "path": "b",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 51,
      "end": 52,
      "target": {
        "path": "b.c",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 53,
      "end": 54,
      "target": {
        "path": "b.c.d",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 57,
      "end": 62,
      "target": {
        "path": "Array",
        "origin": "ecma5"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 71,
      "end": 77,
      "target": {
        "path": "number",
        "origin": "ecma5"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 89,
      "end": 90,
      "target": {
        "path": "E",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 124,
      "end": 125,
      "target": {
        "path": "E",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 129,
      "end": 130,
      "target": {
        "path": "E",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 131,
      "end": 132,
      "target": {
        "path": "E.h",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 138,
      "end": 139,
      "target": {
        "path": "E",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 140,
      "end": 141,
      "target": {
        "path": "E.h",
        "file": "testdata/simple.js"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 149,
      "end": 153,
      "target": {
        "path": "Date",
        "origin": "ecma5"
      }
    },
    {
      "file": "testdata/simple.js",
      "start": 160,
      "end": 171,
      "target": {
        "path": "Date.prototype.toUTCString",
        "origin": "ecma5"
      }
    }
  ],
  "!ref_unresolved": [
    {
      "file": "testdata/simple.js",
      "start": 91,
      "name": "f"
    },
    {
      "file": "testdata/simple.js",
      "start": 102,
      "name": "g"
    },
    {
      "file": "testdata/simple.js",
      "start": 106,
      "name": "f"
    },
    {
      "file": "testdata/simple.js",
      "start": 118,
      "name": "g"
    }
  ]
}
```


## Running tests

Run `npm test`.


## Authors

Contributions are welcome! Submit a GitHub issue or pull request.

* [Quinn Slack (sqs)](https://sourcegraph.com/sqs)
