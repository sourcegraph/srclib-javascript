var dump = require('./dump');
var tern = require('tern');

tern.registerPlugin('jsg', function(server) {
  function markNodeModules(state) {
    function markNodeModule(av) {
      if (!av.metaData) av.metaData = {};
      av.metaData.nodejs = {moduleExports: true};
    }
    var mods = state.cx.parent._node.modules;
    for (var modName in mods) {
      var mod = mods[modName];
      markNodeModule(mod);
    }
  }

  function markAMDModules(state) {
    function markAMDModule(av) {
      if (!av.metaData) av.metaData = {};
      av.metaData.amd = {module: true};
    }
    var mods = state.cx.parent._requireJS.interfaces;
    for (var modName in mods) {
      var mod = mods[modName];
      markAMDModule(mod);
    }
  }

  return {
    passes: {
      postDumpScopeWalk: function(state) {
        if (server.options.plugins.node) markNodeModules(state);
        if (server.options.plugins.requirejs) markAMDModules(state);
      },
    }
  };
});

exports.graph = function(origins, name) {
  return dump.dump(origins, name, {spans: true, flat: false});
};
