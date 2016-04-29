var path = require('path');
var child_process = require('child_process');

module.exports.run = function(dir, srcunit, cb) {

  //:wvar args = [path.join(__dirname, "../lib/analysis")];
  var args = [];
 
  args.push("--max-old-space-size=8192");

  args.push(path.join(__dirname, "../lib/analysis"));

  srcunit.Files.forEach(function(f) {
    args.push(path.join(dir, f));
  });

  //graphData = analysis.initTernServer(srcunit.Files);

  child_process.execFile("node" , args, {
    maxBuffer: 500000 * 1024 * 1024
  }, function(err, stdout, stderr) {
    if (stderr) console.error(stderr);
    if (err) {
      cb(err, null);
      return;
    }

    cb(null, stdout);
  });
}
