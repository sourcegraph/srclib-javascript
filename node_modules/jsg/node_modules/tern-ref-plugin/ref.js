var idents = require('javascript-idents'), infer = require('tern/lib/infer'), tern = require('tern');

tern.registerPlugin('ref', function(server, options) {
  var resolvedIdents = [], unresolvedIdents = [];

  function postCondenseReach(state) {
    var c = {};
    function getSpan(filename, node) {
      return filename + '@' + node.start + '-' + node.end;
    }
    function getPath(filename, node) {
      return c[getSpan(filename, node)];
    };
    function setPath(span, path) {
      span = span.replace(/\[\d+:\d+\]/g, '');
      if (c[span]) console.error('warning:', 'key "' + span + '" is already set to path "' + c[span] + '" (updating to "' + path + '")');
      return c[span] = path;
    };

    function resolveIdent(file, ident) {
      var target = getPath(file.name, ident);
      if (target) {
        return {path: target, origin: file.name};
      }

      try {
        expr = tern.findQueryExpr(file, {start: ident.start, end: ident.end});
      }
      catch (e) {
        console.error('warning: findQueryExpr failed:', e, 'at', ident.name, 'in', file.name, ident.start + '-' + ident.end);
        return;
      }

      var av = infer.expressionType(expr);
      function resolveAValOrType(v) {
        if (!v) return;
        if (v.path) return {origin: v.origin, path: v.path};
        if (v.originNode) {
          var path = getPath(v.origin, v.originNode)
          if (path) {
            return {path: path, origin: v.origin};
          }
        }
      }

      return resolveAValOrType(av) || resolveAValOrType(av.getType());
    }

    Object.keys(state.types).forEach(function(path) {
      var data = state.types[path];
      if (data.span) setPath(data.span, path);
    });

    state.cx.parent.files.forEach(function(file) {
      if (!state.isTarget(file.name)) return;
      idents.inspect(file.ast, function(ident) {
        if (ident.name == "✖") return;
        var t = resolveIdent(file, ident);
        if (t) resolvedIdents.push({file: file.name, start: ident.start, end: ident.end, target: t})
        else unresolvedIdents.push({file: file.name, start: ident.start, name: ident.name});
      });
    });
  }

  return {
    passes: {
      preCondenseReach: function(state) {
        var prevGetSpan = state.getSpan;
        state.getSpan = function(node) {
          var span = prevGetSpan.apply(this, [node]);
          if (span) return node.origin + '@' + span;
        }
      },
      postCondenseReach: function(state) {
        // Must run after plugins that modify state.types.
        state.passes.postCondenseReach.push(postCondenseReach);
      },
      postCondense: function(state) {
        state.output['!ref'] = resolvedIdents;
        state.output['!ref_unresolved'] = unresolvedIdents;
      },
    },
  };
});
