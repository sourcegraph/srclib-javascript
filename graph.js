var dump = require('./dump');
var tern = require('tern');

tern.registerPlugin('jsg', function(server) {
  function markNodeModules(state) {
    var mods = state.cx.parent._node.modules;
    for (var modName in mods) {
      var mod = mods[modName].getType();
      if (!mod) continue;
      if (!mod.metaData) mod.metaData = {};
      mod.metaData.nodejs = {moduleExports: true};
    }
  }

  function markAMDModules(state) {
    var mods = state.cx.parent._requireJS.interfaces;
    for (var modName in mods) {
      var mod = mods[modName].getType();
      if (!mod) continue;
      if (!mod.metaData) mod.metaData = {};
      mod.metaData.amd = {module: true};
    }
  }

  return {
    passes: {
      preCondenseReach: function(state) {
        if (server.options.plugins.node) markNodeModules(state);
        if (server.options.plugins.requirejs) markAMDModules(state);
      },
    }
  };
});

exports.graph = function(origins, name) {
  return dump.dump(origins, name, {spans: true, flat: false});
};
