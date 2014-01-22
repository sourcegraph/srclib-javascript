function Protocol() {

}

Protocol.prototype.serialize = function(req) {
  req.seq = 1;
};

function Client() {
  this.protocol = new Protocol(this);
}

Client.prototype.req = function(req) {
  this.protocol.serialize(req);
};

Client.prototype.setBreakpoint = function(req) {
  req = {};
  this.req(req);
};

Client.prototype.clearBreakpoint = function(req) {
  req = {};
  this.req(req);
};

// Error: Object node path conflict: Protocol.prototype.serialize.!0.seq (path
// for object) and Client.prototype.setBreakpoint.!0.seq (at
// testdata/node_path_conflict.js:79-82)
