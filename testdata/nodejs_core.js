require('fs').readFile;
require('http').createServer;
require('path').join;
(new require('events').EventEmitter()).emit;
var StringDecoder = require('string_decoder').StringDecoder;
StringDecoder.prototype.write;
var decoder = new StringDecoder('utf8');
decoder.write;
var assert = require('assert');

// TODO(sqs): when the constructor_overwrite_prototype_method test passes, this
// test's expected JSON should be updated to include the ref above:
//   decoder.write -> StringDecoder.prototype.write
