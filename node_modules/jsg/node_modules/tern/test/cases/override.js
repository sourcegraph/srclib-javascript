// plugin=override [{"node":{"type":"Identifier","name":"A"},"def":{"A":"string"}},{"node":{"type":"MemberExpression","object":{"type":"Identifier","name":"B"},"property":"c"},"def":{"B":{"c":"number"}}},{"node":{"type":"MemberExpression","object":{"type":"Identifier","name":"D"},"property":"e"},"def":{"D":{"e":{"!type":"fn(obj: ?) -> !0"}}}}]

var A = 7;
A; //: string

var B = {c: "foo"};
B.c; //: number

var D = {e: function() {}};
D.e(1); //: number
D.e(true); //: bool

var b = D.e(true);
b; //: bool

function() {
  var D = {e: "asdf"};
  D.e(function(){}); //: fn()
}

D = 7;
D.e = 5;
D.e("a"); //: string

var s = D.e("a");
s; //: string
