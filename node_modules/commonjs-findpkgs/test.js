var assert = require('assert'), execFile = require('child_process').execFile, fs = require('fs'), path = require('path');
var should = require('should');

describe('commonjs-findpkgs', function() {
  [
    {name: 'a'},
    {name: 'b'},
    {name: 'c'},
    {name: 'multi'},
    {name: 'ignore', args: ['--ignore', '["./package.json", "./subdir"]']},
  ].filter(function(test) { return new RegExp(process.env['F'] || '').test(test.name); }).forEach(function(test) {
    it(test.name, function(done) {
      var expFile = './testdata/' + test.name + '/pkgs.json';
      var want = fs.existsSync(expFile) ? require(expFile) : {};
      var args = [path.join(__dirname, 'bin/commonjs-findpkgs.js')];
      if (test.args) args.push.apply(args, test.args);
      args.push('testdata/' + test.name);
      execFile(process.execPath /* node */, args, function(err, stdout, stderr) {
        if (stderr) console.error(stderr);
        assert.ifError(err);
        if (test.failing) return done();

        var got = JSON.parse(stdout);

        // don't test for equality of the "package" data because that is quite
        // large and makes it harder to debug the important test failures.
        got.forEach(function(pkg) { delete pkg.package; });

        if (process.env['EXP']) {
          var pp = JSON.stringify(got, null, 2);
          fs.writeFile(expFile, pp + '\n', function(err) {
            assert.ifError(err);
            assert(false); // don't let test pass when writing expectation
            done();
          });
          return;
        }
        if (process.env['DEBUG']) {
          console.log(JSON.stringify(got, null, 2));
          got.should.eql(want);
        } else {
          assert.deepEqual(got, want);
        }
        done();
      });
    });
  });
});
