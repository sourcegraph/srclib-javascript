var defnode = require('defnode'), tern = require('tern');

tern.registerPlugin('def-origin', function(server, options) {
  function traverse(state, av) {
    // detect cycles
    if (av._defNodeSeen) return;
    av._defNodeSeen = true;

    if (state.isTarget(av.origin)) {
      var type = av.getType();
      if (type) {
        if (!type.metaData) type.metaData = {};
        if (av.originNode && av.originNode.sourceFile) type.metaData.aval = avalMetaData(av);
        else type.metaData.aval = synthesizeAValMetadata(type);
        type.metaData.type = typeMetaData(type);
      }
    }

    av.forAllProps(function(prop, val, local) {
        traverse(state, val);
    });
  }

  return {
    passes: {
      preCondenseReach: function f(state) {
        // Must run after plugins that modify state.roots.
        state.passes.preCondenseReach.push(function(state) {
          Object.keys(state.roots).forEach(function(rootName) {
            traverse(state, state.roots[rootName]);
          });
          Object.keys(state.cx.topScope.props).forEach(function(prop) {
            traverse(state, state.cx.topScope.props[prop]);
          });
        });
      },
    },
  };
});

function synthesizeAValMetadata(type) {
  if (type.originNode) return {originFile: type.originNode.sourceFile.name, defSpan: formatSpan(type.originNode)};
}

function avalMetaData(av) {
  var md = {
    originFile: av.originNode.sourceFile.name,
    identSpan: formatSpan(av.originNode),
  };
  try {
    var defNode = defnode.findDefinitionNode(av.originNode.sourceFile.ast, av.originNode.start, av.originNode.end)
    if (defNode) {
      md['defSpan'] = formatSpan(defNode);
    }
  } catch (e) {}
  return md;
}

function typeMetaData(t) {
  var md = {};
  if (t.origin) md.origin = t.origin;
  if (t.name) md.name = t.name;
  return md;
}

function formatSpan(node) {
  return node.start + '-' + node.end;
}
