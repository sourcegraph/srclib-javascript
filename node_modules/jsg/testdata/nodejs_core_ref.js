require('fs').readFile;

// Tests that this ref points to !node.fs.readFile, not the readFile function's
// AVal that is reachable via file scope. Just to make for cleaner refs.
