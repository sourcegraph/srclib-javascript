# tern-jquery-api-doc

A plugin for generating [JQuery.js API docs](http://api.jquery.com) on-the-fly and
associating them with the corresponding objects in the
[tern](http://ternjs.net) JavaScript code analysis engine.

It's currently only useful when you are using tern to edit or analyze the
jQuery source.

**Why?** jQuery documentation exists in [XML files in the external
api.jquery.com repository](https://github.com/jquery/api.jquery.com), not in
docstrings embedded in the code. This plugin lets tern parse the XML
documentation and associate it with the corresponding module, function, or
variable. Without this plugin, if you use tern to edit or analyze the jQuery
source, most things will not have associated documentation.

**[Documentation on Sourcegraph](https://sourcegraph.com/github.com/sourcegraph/tern-jquery-api-doc)**

[![Build Status](https://travis-ci.org/sourcegraph/tern-jquery-api-doc.png?branch=master)](https://travis-ci.org/sourcegraph/tern-jquery-api-doc)
[![status](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-jquery-api-doc/badges/status.png)](https://sourcegraph.com/github.com/sourcegraph/tern-jquery-api-doc)
[![authors](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-jquery-api-doc/badges/authors.png)](https://sourcegraph.com/github.com/sourcegraph/tern-jquery-api-doc)
[![Total views](https://sourcegraph.com/api/repos/github.com/sourcegraph/tern-jquery-api-doc/counters/views.png)](https://sourcegraph.com/github.com/sourcegraph/tern-jquery-api-doc)


## Usage

`git clone git://github.com/sourcegraph/tern-jquery-api-doc.git`

### Install dependencies

Run `npm install` to fetch the dependencies. You must also have `xsltproc' installed (see the [api.jquery.com README](https://github.com/jquery/api.jquery.com) for more instructions).


### Configure for use with tern

The plugin has the following configuration options (to be specified in your `.tern-project` file):

* `apiDocDir`: the directory containing the [api.jquery.com](https://github.com/jquery/api.jquery.com) git repository.
* `apiSrcDir`: the path to the `src/` directory in the [jQuery git repository](https://github.com/jquery/jquery).
* `xslFile`: the path to the XSL stylesheet used to perform the XSLT transformation of the XML documentation. Typically this points to the (entries2html.xsl)[https://github.com/jquery/api.jquery.com/blob/master/entries2html.xsl] file in the api.jquery.com git repository.
* `xsltproc`: the path to the `xsltproc` program. If not specified, it looks in the current `$PATH`.
* `html`: if true, attach the whole HTML documentation; if false or unspecified, only attach the short description.

The easiest way to satisfy these requirements is to clone the [github.com/jquery/jquery](https://github.com/jquery/jquery) and [github.com/jquery/api.jquery.com](https://github.com/jquery/api.jquery.com) repositories. If you cloned them to `/home/alice/jquery` and `/home/alice/api.jquery.com`, then you would use the following configuration:

```json
{
  "apiDocDir": "/home/alice/api.jquery.com",
  "apiSrcDir": "/home/alice/jquery/src",
  "xslFile": "/home/alice/api.jquery.com/entries2html.xsl"
}
```

You must also load the `requirejs` plugin and the `jquery-requirejs-extend` defs file from the [jquery branch of sqs/tern](https://github.com/sqs/tern/tree/jquery).


### With tern's condenser

To use this plugin with tern's condenser, specify the configuration on the command line as the following example demonstrates.

```bash
$ cd testdata/jquery
$ ../../node_modules/tern/bin/condense --plugin ../../jquery-api-doc='{"apiDocDir":"../api.jquery.com","apiSrcDir":"src","xslFile":"../api.jquery.com/entries2html.xsl"}' --plugin requirejs --def jquery-requirejs-extend src/core.js src/attributes/attr.js
```

The output is:

```json
{
  "!name": "src/core.js",
  "!define": {
    "!requirejs": {
      "src/core": {
        "fn": {
          "constructor": {
            "!type": "fn(selector: ?, context: ?)",
            "!span": "73[4:10]-312[8:2]",
            "!doc": "Return a collection of matched elements either found in the DOM based on passed argument(s) or created by passing an HTML string. Accepts a string containing a CSS selector which is then used to match a set of elements.",
            "prototype": "!requirejs.src/core.fn",
            "fn": "!requirejs.src/core.fn",
            "extend": "?"
          },
          "toArray": {
            "!type": "fn()",
            "!span": "554[22:10]-598[24:2]"
          },
          "get": {
            "!type": "fn(num: ?) -> !this.<i>",
            "!span": "716[28:6]-901[36:2]",
            "!doc": "Get the Nth element in the matched element set OR Get the whole matched element set as a clean array"
          },
          "pushStack": {
            "!type": "fn(elems: [?])",
            "!span": "1017[40:12]-1307[51:2]",
            "!doc": "Take an array of elements and push it onto the stack (returning the new matched element set)"
          },
          "each": {
            "!type": "fn(callback: fn(), args: ?)",
            "!span": "1472[56:7]-1549[58:2]",
            "!doc": "Execute a callback for every element in the matched set."
          },
          "map": {
            "!type": "fn(callback: ?)",
            "!span": "1558[60:6]-1696[64:2]"
          },
          "slice": {
            "!type": "fn()",
            "!span": "1707[66:8]-1781[68:2]"
          },
          "first": {
            "!type": "fn()",
            "!span": "1792[70:8]-1830[72:2]"
          },
          "last": {
            "!type": "fn()",
            "!span": "1840[74:7]-1879[76:2]"
          },
          "eq": {
            "!type": "fn(i: number)",
            "!span": "1887[78:5]-2028[82:2]"
          },
          "end": {
            "!type": "fn() -> !this.prevObject",
            "!span": "2037[84:6]-2104[86:2]"
          },
          "attr": {
            "!type": "fn(name: ?, value: ?)",
            "!span": "270[13:7]-371[15:2]"
          },
          "removeAttr": {
            "!type": "fn(name: ?)",
            "!span": "387[17:13]-482[21:2]",
            "!doc": "Remove an attribute from each element in the set of matched elements."
          },
          "!span": "346[10:31]-2247[93:1]",
          "extend": "?"
        },
        "extend": {
          "!type": "fn(object: ?) -> !this",
          "!span": "2285[95:35]-3817[158:1]"
        },
        "attr": {
          "!type": "fn(elem: ?, name: ?, value: ?) -> !2",
          "!span": "511[25:7]-1731[71:2]"
        },
        "removeAttr": {
          "!type": "fn(elem: ?, value: ?)",
          "!span": "1747[73:13]-2220[91:2]"
        },
        "attrHooks": {
          "type": {
            "set": {
              "!type": "fn(elem: ?, value: ?) -> !1",
              "!span": "2250[95:3]-2253[95:6]"
            },
            "!span": "2239[94:2]-2243[94:6]"
          },
          "!span": "2235[93:12]-2693[109:2]"
        },
        "prototype": "!requirejs.src/core.fn"
      }
    },
    "!requirejs.src/core.fn.pushStack.!0": "[?]",
    "!requirejs.src/core.fn.each.!0": {
      "!type": "fn()",
      "!span": "425[18:19]-477[20:3]"
    }
  }
}
```

The docs for the jQuery constructor and for `jQuery.fn.removeAttr` came from external XML files in the [testdata/api.jquery.com](./testdata/api.jquery.com) directory, which contains a sample subset of the real [api.jquery.com](https://github.com/jquery/api.jquery.com) repository. The other docs were extracted from the inline docstrings in core.js.


## Running tests

Run `npm test`.


## Authors

Contributions are welcome! Submit a GitHub issue or pull request.

* [Quinn Slack (sqs)](https://sourcegraph.com/sqs)
