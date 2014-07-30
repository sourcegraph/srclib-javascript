var apidoc = require('./jquery-api-doc'), assert = require('assert'), execFile = require('child_process').execFile, path = require('path');

var apiDocDir = 'testdata/api.jquery.com';
var xslFile = 'testdata/api.jquery.com/entries2html.xsl';
var apiSrcDir = 'testdata/jquery/src';
var removeAttrXMLDoc = path.join(apiDocDir, 'entries/removeAttr.xml');
var removeAttrSrcFile = path.join(apiSrcDir, 'src/attributes/classes.js');
var jQueryXMLDoc = path.join(apiDocDir, 'entries/jQuery.xml');
var jQuerySrcFile = path.join(apiSrcDir, 'src/core.js');

describe('jquery-api-doc doc generation', function() {
  it('lists doc source files', function(done) {
    assert.deepEqual(
      apidoc.listDocEntriesSync(apiDocDir),
      ['jQuery', 'removeAttr'].map(function(f) { return path.join(apiDocDir, 'entries', f + '.xml'); })
    );
    done();
  });
  it('gets JSON output from the generate.js script', function(done) {
    var doc = apidoc.parseDocXMLSync(removeAttrXMLDoc)
    assert(doc);
    var want = {
      name: 'removeAttr',
      type: 'method',
      title: '.removeAttr()',
      returnType: 'jQuery',
      signatures: [
        {added: '1.0', args: [{name: 'attributeName', type: 'String'}]},
      ],
      desc: 'Remove an attribute from each element in the set of matched elements.',
      categories: ['attributes', 'manipulation/general-attributes', 'version/1.0', 'version/1.4', 'version/1.7'],
    };
    assert.deepEqual(doc, want);
    done();
  });
  it('generates all docs', function(done) {
    apidoc.generateAllDocs(apiDocDir, xslFile, null, function(err, docs) {
      assert.ifError(err);
      assert(docs);
      assert.equal(docs.entries.length, 2);
      assert.equal(docs.entries[1].docSourceFile, removeAttrXMLDoc);
      done();
    });
  });
});

describe('tern condense output', function() {
  it('should match expected', function(done) {
    var want = require('./testdata/condensed.json');
    execFile(
      process.execPath /* node */,
      [
        '../../node_modules/tern/bin/condense',
        '--plugin', '../../jquery-api-doc={"apiDocDir":"../api.jquery.com","apiSrcDir":"src","xslFile":"../api.jquery.com/entries2html.xsl"}',
        '--plugin', 'requirejs', '--def', '../../node_modules/tern/defs/jquery-requirejs-extend.json',
        'src/core.js', 'src/attributes/attr.js',
      ], {timeout: 10000, cwd: 'testdata/jquery'}, function(err, stdout, stderr) {
        if (stderr) console.error(stderr);
        assert.ifError(err);
        var got = JSON.parse(stdout);
        // console.log(JSON.stringify(got, null, 2));
        assert.deepEqual(got, want);
        done();
      });
  });
});
