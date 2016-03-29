// run jsg on srcunit (a CommonJSPackage), calling cb(err, graphData).
var path = require("path");
var analysis = require("./analysis");

module.exports.run = function(dir, srcunit, cb) {
  //console.error("Files = ", srcunit.Files);
  graphData = analysis.initTernServer(srcunit.Files);

  console.error(graphData);
  cb(null, graphData);
}
