exports.parse = function(path) {
  if (path[0] == '^') {
    return {namespace: 'global', path: path.slice(2)};
  }
  var parts = path.split('.');
  if (parts[0][0] == '@') return {namespace: 'file', module: toDotted(parts[0].slice(1)), path: parts.slice(1).join('.')};
  var namespace = parts[0].slice(1);
  if (namespace == 'node') namespace = 'commonjs';
  return {namespace: namespace, module: toDotted(parts[1]), path: parts.slice(2).join('.')};
}

function toDotted(s) {
  return s.replace(/`/g, '.');
}
