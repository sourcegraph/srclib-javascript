module.exports.normalizePath = function(p) {
  return p.replace(/\\/g, '/');
}

module.exports.formPath = function() {
  return Array.prototype.slice.call(arguments).join('/');
}

module.exports.isImportClauseForProcessing = function(type) {
  return (type == 'ImportDefaultSpecifier' || type == 'ImportSpecifier' || type == 'ImportNamespaceSpecifier');
}
