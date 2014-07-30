var acorn = require('acorn'),
    astannotate = require('astannotate'),
    defnode = require('./defnode'),
    fs = require('fs'),
    path = require('path'),
    should = require('should');

describe('findDefinitionNode', function() {
  ['assign.js', 'func.js', 'globals.js', 'object.js'].forEach(function(filename) {
    it(filename, function(done) {
      var file = fs.readFile(path.join('testdata/findDefinitionNode', filename), 'utf8', function(err, text) {
        should.ifError(err);
        var visitor = astannotate.nodeVisitor('DEF', function(type) { return type == 'Identifier' || type == 'Literal'; }, function(name, defInfo) {
          var def = defnode.findDefinitionNode(acorn.parse(text), name.start, name.end);
          if (defInfo == 'null') {
            should.not.exist(def);
          } else {
            defInfo = defInfo.split(',')
            var defNodeType = defInfo[0], defOffsets = defInfo.slice(1).map(parseFloat);
            should.exist(def);
            def.type.should.eql(defNodeType);
            if (defOffsets[0]) {
              ({type: def.type, start: def.start, end: def.end}).should.eql({type: defNodeType, start: name.start + defOffsets[0], end: name.end + defOffsets[1]});
            }
          }
        });
        var ast = acorn.parse(text)
        visitor(text, ast);
        done();
      });
    });
  });
});

describe('findNameNodes', function() {
  ['assign.js', 'func.js', 'func_assign.js', 'globals.js', 'object.js'].forEach(function(filename) {
    it(filename, function(done) {
      var file = fs.readFile(path.join('testdata/findNameNodes', filename), 'utf8', function(err, text) {
        should.ifError(err);
        function mkNameVisitor(directive) {
          return astannotate.rangeVisitor(directive, null, function(range, names) {
            should.exist(range.node);
            var nameNodes = defnode.findNameNodes(acorn.parse(text), range.node.start, range.node.end);
            should.exist(nameNodes);
            if (names == 'null') {
              nameNodes.should.eql([]);
            } else {
              nameNodes.map(function(i) { return defnode.identOrLiteralString(i); }).should.eql(names.split(','));
            }
          });
        }
        // Allow nesting of NAME directives (NAME1 can be nested under NAME).
        var visitor = astannotate.multi([mkNameVisitor('NAME'), mkNameVisitor('NAME1')]);
        var ast = acorn.parse(text)
        visitor(text, ast);
        done();
      });
    });
  });
});
