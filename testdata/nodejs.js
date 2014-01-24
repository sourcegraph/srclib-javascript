exports.a = function() { return 3; }
exports.b = {
  c: 3
};
exports.a;
module.exports.a;
require('fs').readFileSync;

// TODO(sqs):
// a few issues:
// 1. nodejs "module" global is being emitted as being in file scope
// 2. there are refs to "exports" not "module.exports"
