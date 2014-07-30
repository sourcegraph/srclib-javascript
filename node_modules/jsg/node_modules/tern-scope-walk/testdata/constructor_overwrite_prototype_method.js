function A() {
  this.b = function() {};
};
A.prototype.b = function() {};

new A().b;

// This is a failing test. We want the last "b" to point to the A.prototype.b,
// but it points to the this.b definition. This is not a well-defined
// requirement, so it's unclear how to implement this "fix."
