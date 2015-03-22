var BASE_DPI = 96;

var through = require('through-gulp'),
  eval = require('eval'),
  path = require("path"),
  fs = require("fs"),
  util = require('gulp-util'),
  images = require("images"),
  spritesmith = require('spritesmith'),
  fs = require('fs'),
  mkdirp = require("mkdirp"),
  cssClassName = require("./index").className;

function resizeImage(opts, width, height) {
  var className = opts.className
  var imageBuffer = opts.image
    .resize(
      width * opts.deviceRatio,
      height * opts.deviceRatio)
    .encode("png");
  return imageBuffer;
}

function imageName(className, deviceRatio) {
  return className.replace(" ", ".") + "." + deviceRatio + ".png";
}

var collate = module.exports = function(opts) {
  var cwd = process.cwd()
  var base = path.join(cwd, opts.base || "");
  var tmp = opts.tmp || ".tmp/";
  var urlPrefix = opts.urlPrefix || '/public'
  var spritePaths = {};
  var spriteClasses = {};
  var spriteSizes = {};
  var deviceRatios = opts.deviceRatios;
  var maximumDeviceRatio = 1;
  var doCollate = opts.collate;

  // If doCollate is false, no spritesheet is generated.
  // This would cause this function to run a lot faster.
  // Ideal for development mode.

  Object.keys(deviceRatios).forEach(function(deviceRatio) {
    if (deviceRatio > maximumDeviceRatio) {
      maximumDeviceRatio = deviceRatio;
    };
  });

  if (!deviceRatios[1]) {
    console.log("A device ratio of 1 must always specified.");
  }

  var cache = {};
  return through(
    function(file, encoding, cb) {
      var src = file.contents.toString();
      var stream = this;
      var count = 0;
      var isEvaluated = false;
      eval(src, file.path, {
        __128931283SpriteRegister: function(opts) {
          var className = cssClassName(opts);
          if (!cache[className]) {
            var image = images(imagePath);
            var imageSize = image.size();
            var imagePath = path.join(base, opts.src);
            var width = opts.width || 
              (imageSize.width / maximumDeviceRatio);
            var height = opts.height || 
              (imageSize.height / maximumDeviceRatio);
            Object.keys(deviceRatios).forEach(function(deviceRatio) {
              count += 1;
              cache[className] = opts;
              var imgBuffer = resizeImage({
                className: className,
                deviceRatio: deviceRatio,
                image: images(imagePath)
              }, width, height);
              var imgName = imageName(className, deviceRatio);
              var imgPath = path.join(cwd, tmp, imgName);
              spritePaths[deviceRatio] = spritePaths[deviceRatio] || [];
              spritePaths[deviceRatio].push(imgPath);
              spriteClasses[imgPath] = className;
              spriteSizes[imgPath] = {
                width: width,
                height: height
              }
              if (!doCollate) {
                stream.push(new util.File({
                  cwd: cwd,
                  base: "",
                  path: imgName,
                  contents: imgBuffer
                }));
              }
              else {
                var callback = function(err) {
                  if (err) console.error(err);
                  count -=1;
                  if (isEvaluated == true && count == 0) {
                    cb();
                  }
                }
                mkdirp(path.dirname(imgPath), function(err) {
                  if (err) callback(err);
                  fs.writeFile(imgPath, imgBuffer, function(err) {
                    callback(err);
                  });
                });
              }
            });
          }
          return className;
        }
      }, true);
      isEvaluated = true;
      if (!doCollate) {
        cb()
      }
    }, 
    function(cb) {
      var stream = this;
      var count = Object.keys(deviceRatios).length;
      var css = [];
      if (!doCollate) {
        /* Every image CSS classes have one sprite sheet each */
        Object.keys(deviceRatios).forEach(function(deviceRatio) {
          if (deviceRatio == 1) {
            css.push(
              ".node-spritecss-bg {" +
                  "background-repeat: no-repeat;" +
              "}");
          }
          else {
            css.push(
              "@media(-webkit-min-device-pixel-ratio: " + deviceRatio + 
                "), (min-resolution: "+(BASE_DPI * deviceRatio)+"dpi) {\n");
          }
          spritePaths[deviceRatio].forEach(function(spritePath) {
            var className = spriteClasses[spritePath];
            var spriteSize = spriteSizes[spritePath];
            var imgName = imageName(className, deviceRatio);
            if (deviceRatio == 1) {
              css.push("." + className.replace(" ", ".") + "{" +
                "background: url('" + urlPrefix + imgName + "');" + 
                "width: " + spriteSize.width + "px !important;" +
                "height: " + spriteSize.height + "px !important;" +
                "background-size: " + spriteSize.width + "px " + 
                  spriteSize.height + "px;" +
                "display: inline-block;" +
              "}");
            }
            else {
              css.push("." + className.replace(" ", ".") + "{" +
                "background-image: url('" + urlPrefix + imgName + "');" + 
              "}");
            }
          });
          if (deviceRatio != 1) {
            css.push("}");
          }
        });
        stream.push(new util.File({
          cwd: "", 
          base: "", 
          path: opts.cssName,
          contents: new Buffer(css.join("\n"))
        }));
      cb();
      return;
    }
    /* Every image CSS classes share one sprite sheet */
    Object.keys(deviceRatios).forEach(function(deviceRatio) {
      spritesmith({src: spritePaths[deviceRatio]}, function(err, result) {
        var imgName = deviceRatios[deviceRatio];
        count -=1;
        if (err) {
          console.error(err);
        }
        stream.push(new util.File({
          cwd: "", 
          base: "", 
          path: deviceRatios[deviceRatio],
          contents: new Buffer(result.image, 'binary')
        }));
        
        if (deviceRatio == 1) {
          css.push(
            ".node-spritecss-bg {" +
                "background-image: url('" + urlPrefix + imgName + "');" + 
                "background-size: " + result.properties.width + "px " + 
                  result.properties.height + "px;" +
                "background-repeat: no-repeat;" +
            "}");
          Object.keys(result.coordinates).forEach(function(key) {
            var coordinate = result.coordinates[key];
            var className = spriteClasses[key];
            css.push("." + className.replace(" ", ".") + "{" +
              "background-position: -" + coordinate.x + "px -" + 
                coordinate.y + "px;" + 
              "width: " + coordinate.width + "px !important;" +
              "height: " + coordinate.height + "px !important;" +
              "display: inline-block;" +
            "}");
          });
        }
        else {
          css.push(
          "@media(-webkit-min-device-pixel-ratio: " + deviceRatio + 
            "), (min-resolution: "+(BASE_DPI * deviceRatio)+"dpi) {\n" +
              ".node-spritecss-bg {" +
                  "background-image: url('" + urlPrefix + imgName + "');" + 
              "}\n"+ 
          "}");
        }
        if (count == 0) {
          stream.push(new util.File({
            cwd: "", 
            base: "", 
            path: opts.cssName,
            contents: new Buffer(css.join("\n"))
          }));
          cb();
        };
      });
    });
  });
}

