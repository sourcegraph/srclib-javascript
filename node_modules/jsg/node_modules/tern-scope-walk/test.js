var assert = require('assert'), execFile = require('child_process').execFile, fs = require('fs'), path = require('path');
var should = require('should');

describe('scope-walk', function() {
  [
    {name: 'var'},
    {name: 'var_chained'},
    {name: 'func'},
    {name: 'func_anon'},
    {name: 'func_prop'},
    {name: 'func_param_prop'},
    {name: 'obj'},
    {name: 'obj_share'},

    {name: 'prefer_exported', args: ['--plugin', 'node']},

    {name: 'recv'},
    {name: 'builtin_origin'},
    {name: 'target_primitive'},
    {name: 'requirejs', args: ['--plugin', 'requirejs'], files: ['requirejs_b', 'requirejs']},
    {name: 'requirejs_objdef_file', args: ['--plugin', 'requirejs'], files: ['requirejs_objdef_def', 'requirejs_objdef_other']},
    {name: 'nodejs', args: ['--plugin', 'node']},
    {name: 'nodejs_require', args: ['--plugin', 'node']},
    {name: 'nodejs_exports', args: ['--plugin', 'node']},
    {name: 'nodejs_module_export_func', args: ['--plugin', 'node']},
    {name: 'anonymous'},

    {name: 'type_ref'},
    {name: 'nodejs_export_function_a_b', args: ['--plugin', 'node']},
    {name: 'nodejs_type_ref', args: ['--plugin', 'node']},
    {name: 'nodejs_other_module_type_export', args: ['--plugin', 'node'], files: ['nodejs_other_module_type_export', 'nodejs_export_function_a']},
    {name: 'nodejs_other_module_type_ref_a_b', args: ['--plugin', 'node'], files: ['nodejs_other_module_type_ref_a_b', 'nodejs_export_function_a_b']},
    {name: 'nodejs_other_module_type_ref_named', args: ['--plugin', 'node']},
    {name: 'nodejs_require_mod0', args: ['--plugin', 'node']},
    {name: 'nodejs_require_exported_node_origin_type', args: ['--plugin', 'node']},
    {name: 'nodejs_require_ecma5_type', args: ['--plugin', 'node']},
  ].filter(function(test) { return new RegExp(process.env['F'] || '').test(test.name); }).forEach(function(test) {
    it(test.name + ' (with args: ' + (test.args || []).join(' ') + ')', function(done) {
      var expFile = './testdata/' + test.name + '.json';
      var want = fs.existsSync(expFile) ? require(expFile) : {};
      var args = [path.join(__dirname, 'bin/scope-walk')];
      if (test.args) args.push.apply(args, test.args);
      (test.files || [test.name]).forEach(function(f) { args.push('testdata/' + f + '.js'); });
      execFile(process.execPath /* node */, args, function(err, stdout, stderr) {
        if (stderr) console.error(stderr);
        assert.ifError(err);
        if (test.failing) return done();
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
