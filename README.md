# srclib-javascript [![Build Status](https://travis-ci.org/sourcegraph/srclib-javascript.png?branch=master)](https://travis-ci.org/sourcegraph/srclib-javascript)

**srclib-javascript** is a [srclib](https://sourcegraph.com/sourcegraph/srclib)
toolchain that performs JavaScript (Node.js) code analysis: type inference,
documentation generation, jump-to-definition, dependency resolution, etc.

It enables this functionality in any client application whose code analysis is
powered by srclib, including [Sourcegraph](https://sourcegraph.com).

Screenshots are below.

## Installation

This toolchain is not a standalone program; it provides additional functionality
to applications that use [srclib](https://srclib.org).

First,
[install the `src` program (see srclib installation instructions)](https://sourcegraph.com/sourcegraph/srclib).

Then run:

```
git clone https://github.com/sourcegraph/srclib-javascript.git
cd srclib-javascript
src toolchain add sourcegraph.com/sourcegraph/srclib-javascript
```

To verify that installation succeeded, run:

```
src toolchain list
```

You should see this srclib-javascript toolchain in the list.

Now that this toolchain is installed, any program that relies on srclib will support JavaScript.

(TODO(sqs): add a tutorial link)

## Screenshot

Here's what srclib-javascript's analysis looks like in these applications.

The first screenshot shows the
[Underscore JavaScript library](https://sourcegraph.com/github.com/jashkenas/underscore/.CommonJSPackage/underscore/.def/commonjs/underscore.js/-/every)
on [Sourcegraph.com](https://sourcegraph.com). Here, srclib-javascript enables
clickable links for every identifier (that take you to their definitions),
automatic cross-repository usage examples, type inference, and documentation
generation.

![screenshot](https://s3-us-west-2.amazonaws.com/sourcegraph-assets/sourcegraph-javascript-screenshot-0.png "Sourcegraph.com JavaScript screenshot")

The second screenshot shows the
[emacs-sourcegraph-mode plugin for Emacs](https://sourcegraph.com/sourcegraph/emacs-sourcegraph-mode)
with this toolchain installed. Here, srclib-javascript enables
jump-to-definition, type inference, documentation generation, and automatic
cross-repository usage examples from [Sourcegraph.com](https://sourcegraph.com).
All code analysis is performed locally by [srclib](https://srclib.org) using
this toolchain.

![screenshot](https://s3-us-west-2.amazonaws.com/sourcegraph-assets/emacs-sourcegraph-mode-screenshot-0.png "Emacs JavaScript screenshot")

## Known issues

srclib-javascript is alpha-quality software. It powers code analysis on
[Sourcegraph.com](https://sourcegraph.com) but has not been widely tested or
adapted for other use cases. It also has several limitations.

* Currently only detects and analyzes CommonJS packages (anything with a
  package.json), including Node.js packages. In particular, this means it
  **generally does not handle front-end/client-side JavaScript**.
* Does not handle global ECMAScript 5 (`Array.prototype.` methods, etc.) or
  browser objects (`window`, `document`, etc.) well.
* Gets easily confused by complex CommonJS module re-exporting. (E.g., when an
  index.js file requires submodules and re-exports them, it doesn't do a good
  job of tracing external invocations of the module to their actual function
  literal definition.)

## Tests

Testing this toolchain requires that you have installed `src` from
[srclib](https://sourcegraph.com/sourcegraph/srclib) and that you have this
toolchain set up. See srclib documentation for more information.

To test this toolchain's output against the expected output, run:

```
# build the Docker container to run the tests in isolation
src toolchain build sourcegraph.com/sourcegraph/srclib-javascript

# run the tests
src test
```

By default, that command runs tests in an isolated Docker container. To run the
tests on your local machine, run `src test -m program`. See the srclib
documentation for more information about the differences between these two
execution methods.

## Contributing

Patches are welcomed via GitHub pull request! See
[CONTRIBUTING.md](./CONTRIBUTING.md) for more information.

srclib-javascript's type inference is based on [Tern](http://ternjs.net/).
