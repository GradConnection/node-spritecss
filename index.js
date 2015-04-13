var className = require('./className');

module.exports = {
  className: function(opts) {
    if (typeof __className !== "undefined") {
      return __className(opts);
    }
    else {
      return className(opts);
    }
  }
};
