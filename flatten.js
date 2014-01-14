module.exports = function flatten(condensed, prefix, flattened) {
  if (!flattened) flattened = {};
  for (var k in condensed) if (condensed.hasOwnProperty(k)) {
    if (k == '!ref' || k == '!ref_unresolved') {
      flattened[k] = condensed[k];
      continue;
    }
    var v = condensed[k];
    var special = k[0] === '!' || k[0] === '@';
    var primitive = typeof v !== 'object';
    var preserve = primitive || k === '!data';
    if (special) {
      var base;
      if (prefix) {
        if (!flattened[prefix]) flattened[prefix] = {};
        base = flattened[prefix]
      } else {
        base = flattened;
      }
      base[k] = preserve ? v : flatten(v);
    } else if (preserve) flattened[path(prefix, k)] = v;
    else flatten(v, path(prefix, k), flattened);
  }
  return flattened;
};


var SEP = '.';
function path(prefix, key) {
  if (prefix) return prefix + SEP + key;
  else return key;
}

if (!module.parent) {
  process.stdin.resume();
  var input = JSON.parse(require('fs').readFileSync('/dev/stdin'));
  console.log(JSON.stringify(module.exports(input), null, 2));
}
