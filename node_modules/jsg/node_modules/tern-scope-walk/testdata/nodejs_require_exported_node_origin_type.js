var a = require('./nodejs_export_node_origin_type');
require('./nodejs_export_node_origin_type_2').b;

// This tests that although "a" and "b" have paths that refer to their local
// re-exports, since they refer to types with an origin of "node", their ref
// paths correctly point to "node".
