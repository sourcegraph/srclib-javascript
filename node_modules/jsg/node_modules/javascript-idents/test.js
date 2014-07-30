var idents = require('./idents');
var acorn = require('acorn'), assert = require('assert');

// identNames parses the AST of the JavaScript source code and returns an array of the names of each
// Identifier AST node.
function identNames(source, includeLiteralKeys) {
  return idents.all(acorn.parse(source), includeLiteralKeys).map(function(id) { return id.name || id.value; });
}

describe('Identifiers', function() {
  it('lists identifiers in JS file', function(done) {
    var src = 'var a={b: 3}; var c = a.b[d]; function f(w, x, y) { return z - q ? r : s; }';
    assert.deepEqual(
      identNames(src),
      ['a', 'b', 'c', 'a', 'b', 'd', 'f', 'w', 'x', 'y', 'z', 'q', 'r', 's']
    );
    done();
  });
  it('lists object keys', function(done) {
    var src = '({a:1, b: {c: 2}})';
    assert.deepEqual(
      identNames(src),
      ['a', 'b', 'c']
    );
    done();
  });
  it('lists object keys that are Literals', function(done) {
    var src = '({"a":1, "b": {"c": 2}})';
    assert.deepEqual(
      identNames(src, true),
      ['a', 'b', 'c']
    );
    done();
  });
  it('lists MemberExpression assignments whose property is a single Literal', function(done) {
    var src = 'm["a"]=1;m["b"+"c"]=2;';
    assert.deepEqual(
      identNames(src, true),
      ['m', 'a', 'm']
    );
    done();
  });
  it('does not list null anonymous function names as identifiers', function(done) {
    var src = 'var a = function() {};';
    assert.deepEqual(identNames(src), ['a']);
    done();
  });
});
