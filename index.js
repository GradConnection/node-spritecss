module.exports = {
  className: 
    (typeof __128931283SpriteRegister !== "undefined") ? 
      __128931283SpriteRegister:
      function(opts) {
        var name = opts.src.replace(/[\W_]/g, "-");
        if (opts.width || opts.height) {
          var numberOfPixels = opts.width * opts.height;
          return "node-spritecss-bg node-spritecss-" + name + "-" + opts.width + "-" + 
            opts.height;
        }
        else {
          return "node-spritecss-bg node-spritecss-" + name + "-" + "default"
        }
      }
};
