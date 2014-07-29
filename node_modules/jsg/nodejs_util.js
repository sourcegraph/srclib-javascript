var fs = require('fs');
var path = require('path');
var normalizePackageData = require('normalize-package-data');

exports.addPackageInfo = function(target) {
  var cacheKey = target.module;
  var info = packageInfoCache[cacheKey];
  if (!packageInfoCache.hasOwnProperty(cacheKey)) {
    var parts = target.module.split(path.sep);
    for (var i = parts.length - 2; i >= 0; i--) {
      if (parts[i] == 'node_modules') {
        // Skip modules located directly underneath a "node_modules" dir.
        if (i > parts.length - 3) continue;

        info = {};
        info.name = parts[i + 1];
        info.dir = parts.slice(0, i + 2).join(path.sep);
        var packagejson = path.join(info.dir, 'package.json');
        if (fs.existsSync(packagejson)) {
          info.packageJSONFile = packagejson;
          try {
            var pkgdata = JSON.parse(fs.readFileSync(packagejson));
            normalizePackageData(pkgdata);
            if (pkgdata.repository) info.repository = pkgdata.repository;
          } catch (e) {}
        }

        packageInfoCache[cacheKey] = info;
        break;
      }
    }
  }

  if (info) {
    target.npmPackage = info;
  } else {
    packageInfoCache[cacheKey] = null;
  }
}

var packageInfoCache = {};
