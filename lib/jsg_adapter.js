// run jsg on srcunit (a CommonJSPackage), calling cb(err, graphData).
var path = require('path');
var child_process = require('child_process');

//var analysis = require("./analysis");

module.exports.run = function(dir, srcunit, cb) {
  //console.error("Files = ", srcunit.Files);s

  var args = [path.join(__dirname, "../lib/analysis")];

  srcunit.Files.forEach(function(f) {
    args.push(path.join(dir, f));
  });

  //graphData = analysis.initTernServer(srcunit.Files);

  child_process.execFile(process.execPath /* node */ , args, {
    maxBuffer: 250 * 1024 * 1024
  }, function(err, stdout, stderr) {
    if (stderr) console.error(stderr);
    if (err) {
      cb(err, null);
      return;
    }

    cb(null, stdout);
  });
}
