var n = require('./nodejs');
n.a;
n.b.c;

exports.a2 = n.a;
exports.b2 = n.b;
exports.c2 = n.b.c;
