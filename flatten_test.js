var flatten = require('./flatten');
var assert = require('assert');

describe('flatten', function() {
  it('preserves keys starting with "!"', function(done) {
    var input = {'!define': {'!foo': {a: 1}}};
    assert.deepEqual(
      flatten(input),
      input
    );
    done();
  });
  it('preserves nested keys starting with "!"', function(done) {
    var input = {a: {'!foo': 1}};
    assert.deepEqual(
      flatten(input),
      input
    );
    done();
  });
  it('flattens simple 1', function(done) {
    assert.deepEqual(
      flatten({a: {b: 1}}),
      {'a.b': 1}
    );
    done();
  });
  it('flattens simple 2', function(done) {
    assert.deepEqual(
      flatten({a: {b: 1}, c: {d: {e: 1, f: 2}}}),
      {'a.b': 1, 'c.d.e': 1, 'c.d.f': 2}
    );
    done();
  });
  it('flattens complex 1', function(done) {
    assert.deepEqual(
      flatten({'!define': {a: {b: 1, '!foo': 'bar'}}}),
      {'!define': {'a': {'!foo': 'bar'}, 'a.b': 1}}
    );
    done();
  });
  it('flattens complex 2', function(done) {
    assert.deepEqual(
      flatten({
        '!name': 'foo.js',
        '!define': {
          '!node': {
            a: {
              b: {
                '!b1': 1,
                '!b2': 2,
              },
              '!a1': 1,
              '!a2': 2,
            },
          },
          x: {
            y: {
              '!y1': 1,
              '!y2': 2,
            },
            '!x1': 1,
            '!x2': 2,
          }
        }
      }),
      {
        '!name': 'foo.js',
        '!define': {
          '!node': {
            'a.b': {
              '!b1': 1,
              '!b2': 2
            },
            a: {
              '!a1': 1,
              '!a2': 2
            }
          },
          'x.y': {
            '!y1': 1,
            '!y2': 2
          },
          x: {
            '!x1': 1,
            '!x2': 2
          }
        }
      }
    );
    done();
  });
});
