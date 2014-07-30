// plugin=override [{"node":{"type":"MemberExpression","object":{"type":"Identifier","name":"A"},"property":"b"},"def":{"A":{"!hint":true,"!type":"fn()","b":{"!type":"fn() -> number"}}},"add":true}]

function A() {}
A.b = function() {};

A.b(); //: number
A.b; //loc: 4,2
