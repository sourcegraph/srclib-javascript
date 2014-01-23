console.log;

// Tests that "log" points to require('console').Console.prototype.log, not just
// require('console').log. This will become unnecessary if we properly alias
// those 2 paths.
