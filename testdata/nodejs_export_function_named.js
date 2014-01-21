var B = {
  A: function () {}
};
B.A.c = function() {};
exports.c = B.A.c;
