// environment=type_hints

var n;
n; //: number
n; //loc: 3,4

function F() {}
F; //: fn(string) -> number
F; //loc: 7,9
F; //origin: type_hint.js
F; //doc: doc for F

var o = {c: function() {}};
o.c; //: fn(number) -> string
o.c; //loc: 13,9
o.c; //origin: type_hint.js
o; //:: {c: fn(number) -> string}
o; //loc: 13,4
o; //origin: type_hint.js
