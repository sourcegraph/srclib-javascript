exports.parse = function(path) {
  if (path[0] != '!') {
    return {namespace: 'global', path: path};
  }
  var parts = path.split('.');
  var namespace = parts[0].slice(1);
  if (namespace == 'node') namespace = 'commonjs';
  if (!parts[1]) console.error(parts);
  return {namespace: namespace, module: parts[1].replace(/`/g, '.'), path: parts.slice(2).join('.')};
}
