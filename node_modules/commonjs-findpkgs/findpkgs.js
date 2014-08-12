var glob = require('glob');
var path = require('path');
var fs = require('fs');
var readJson = require('read-package-json');

// findpkgs finds CommonJS packages in dir, ignoring paths in ignores. The
// callback is called as cb(err, pkgs), where pkgs is an array of objects
// describing the packages that were found.
module.exports = function(dir, ignores, cb) {
  glob(path.join(dir, '**/package.json'), function(err, files) {
    if (err) {
      console.error('Error finding package.json files:', err);
      process.exit(1);
    }

    // check that files are not ignored
    files = files.filter(function(file) {
      if (ignores) {
        for (var i = 0; i < ignores.length; i++) {
          if (file.indexOf(ignores[i]) == 0) return false; // skip processing file
        }
      }
      return true;
    });

    if (files.length == 0) {
      cb(null, []);
      return;
    }

    var pkgs = [];
    files.forEach(function(file) {
      readJson(file, function(err, data) {
        var pkgdir = path.dirname(file);

        var libFiles = glob.sync(path.join(pkgdir, 'lib/**/*.js'));
        if (!err) {
          var mainFile = findMainFile(pkgdir, data.main || 'index');
          if (mainFile && libFiles.indexOf(mainFile) == -1) libFiles.push(mainFile);
        }

        pkgs.push({
          dir: pkgdir,
          packageJSONFile: file,
          package: data,
          error: err || undefined,
          libFiles: libFiles,
          testFiles: glob.sync(path.join(pkgdir, 'test/**/*.js')),
        });
        if (pkgs.length == files.length) cb(null, pkgs);
      });
    });
  });
};

function findMainFile(dir, main) {
  var poss = [main];
  if (!/\.js(on)?$/.test(main)) poss.push(main + '.js', main + '.json');
  var found;
  poss.forEach(function(f) {
    if (fs.existsSync(path.join(dir, f))) found = f;
  });
  if (found) return path.join(dir, found);
}
