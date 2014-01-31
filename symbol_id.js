exports.parse = function(path) {
  if (path[0] == '^') {
    return {namespace: 'global', path: cleanPath(path.slice(2))};
  }
  var parts = path.split('.');
  if (parts[0][0] == '@') return {namespace: 'file', module: toDotted(parts[0].slice(1)), path: cleanPath(parts.slice(1).join('.'))};
  var namespace = parts[0].slice(1);
  if (namespace == 'node') namespace = 'commonjs';
  return {namespace: namespace, module: toDotted(parts[1]), path: cleanPath(parts.slice(2).join('.'))};
}

function toDotted(s) {
  return s.replace(/`/g, '.');
}

// cleanPath escapes unprintable chars in p.
function cleanPath(p) {
  p = JSON.stringify(p);
  return p.slice(1, p.length - 1);
}
