var assert = require('assert'), execFile = require('child_process').execFile, fs = require('fs'), path = require('path');

describe('tern condense output', function() {
  [
    {name: 'simple'},
    {name: 'builtin_origin'},
    {name: 'target_primitive'},
    {name: 'requirejs', args: ['--plugin', 'requirejs', 'testdata/requirejs_b.js']},
    {name: 'nodejs', args: ['--plugin', 'node']},
    {name: 'anonymous'},
    {name: 'locals', args: ['--plugin', 'node_modules/tern-local-scope-condense-plugin/local-scope-condense']},
  ].filter(function(file) { return new RegExp(process.env['F'] || '').test(file.name); }).forEach(function(file) {
    it(file.name + ' (with args: ' + (file.args || []).join(' ') + ')', function(done) {
      var expFile = './testdata/' + file.name + '.json';
      var want = require(expFile);
      var args = ['node_modules/tern/bin/condense'];
      if (file.args) args.push.apply(args, file.args);
      args.push('--plugin', 'ref', 'testdata/' + file.name + '.js')
      execFile(process.execPath /* node */, args, function(err, stdout, stderr) {
        if (stderr) console.error(stderr);
        assert.ifError(err);
        var got = JSON.parse(stdout);
        if (process.env['EXP']) {
          var pp = JSON.stringify(got, null, 2);
          fs.writeFile(expFile, pp + '\n', function(err) {
            assert.ifError(err);
            assert(false); // don't let test pass when writing expectation
            done();
          });
          return;
        }
        if (process.env['DEBUG']) console.log(JSON.stringify(got, null, 2));
        assert.deepEqual(got, want);
        done();
      });
    });
  });
});
