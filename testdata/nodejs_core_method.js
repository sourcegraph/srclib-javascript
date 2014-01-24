var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');
decoder.write('a');

// This is an incorrect test. `write` refers to `decoder.write`, not
// string_decoder.StringDecoder.prototype.write, as it should.
