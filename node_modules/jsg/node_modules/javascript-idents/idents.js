var walk = require('acorn/util/walk');

// inspect traverses the AST starting at node, calling found with each Identifier AST node it
// encounters. If includeLiteralKeys is true, then string literals in
// ObjectExpressions are also found.
exports.inspect = function(node, found, includeLiteralKeys) {
  var identWalker = walk.make({
    Function: function(node, st, c) {
      if (node.id) c(node.id, st);
      for (var i = 0; i < node.params.length; ++i) {
        var param = node.params[i];
        c(param, st);
      }
      // TODO(sqs): defaults, rest?
      c(node.body, st, 'ScopeBody');
    },
    Identifier: function(node) {
      found(node);
    },
    MemberExpression: function(node, st, c) {
      c(node.object, st);
      if (node.property.type === 'Identifier' || (node.property.type === 'Literal' && includeLiteralKeys)) {
        c(node.property, st, 'Identifier');
      }
    },
    ObjectExpression: function(node, st, c) {
      for (var i = 0; i < node.properties.length; ++i) {
        var prop = node.properties[i];
        if (prop.key.type === 'Identifier' || includeLiteralKeys) {
          c(prop.key, st, 'Identifier');
        }
        c(prop.value, st);
      }
    },
    VariableDeclaration: function(node, st, c) {
      for (var i = 0; i < node.declarations.length; ++i) {
        var decl = node.declarations[i];
        if (decl.id.type === 'Identifier') {
          c(decl.id, st);
        }
        if (decl.init) c(decl.init, st, 'Expression');
      }
    },
  });
  walk.recursive(node, null, identWalker);
};

// all traverses the AST starting at node and returns an array of all Identifier AST nodes it
// encounters. If includeLiteralKeys is true, then string literals in
// ObjectExpressions are also found.
exports.all = function(node, includeLiteralKeys) {
  var idents = [];
  exports.inspect(node, function(ident) {
    idents.push(ident);
  }, includeLiteralKeys);
  return idents;
};
