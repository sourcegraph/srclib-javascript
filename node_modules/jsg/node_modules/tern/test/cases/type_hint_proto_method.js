// environment=proto_method

function X() {}

X.prototype = {w: function() {}};

X.prototype.extend = function() {};
X.prototype.extend({y: function() { return 1; }});
X.prototype.extend; //: fn(obj: ?)
X.prototype.extend; //origin: type_hint_proto_method.js

X.prototype; //:: {extend: fn(obj: ?), w: fn(), y: fn() -> number}

(new X()).y; //: fn() -> number
