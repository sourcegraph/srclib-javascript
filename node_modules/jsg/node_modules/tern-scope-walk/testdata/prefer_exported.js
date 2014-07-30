var fs = exports;

fs.a = function() {};

// Tests what the node core API "fs" module does. We want the path to "a" to be
// a commonjs-namespace path instead of a file-scope path.
