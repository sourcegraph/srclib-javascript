var walkall = require('./walkall');
var acorn = require('acorn'), should = require('should'), walk = require('acorn/util/walk');

describe('walkall', function() {
  it('walks all AST nodes', function(done) {
    var ast = acorn.parse('var foo = function(a) {}, bar = {a: 7}, c = 2+2;');
    var nodeTypes = [];
    walk.simple(ast, walkall.makeVisitors(function(node) {
      nodeTypes.push(node.type);
    }), walkall.traversers);
    nodeTypes.should.eql([
      'Identifier',
      'BlockStatement',
      'Identifier',
      'FunctionExpression',
      'VariableDeclarator',
      'Identifier',
      'Identifier',
      'Literal',
      'ObjectExpression',
      'VariableDeclarator',
      'Identifier',
      'Literal',
      'Literal',
      'BinaryExpression',
      'VariableDeclarator',
      'VariableDeclaration',
      'Program',
    ]);
    done();
  });
});
