var BASE_DPI = 96;

var through = require('through-gulp'),
  vm = require('vm'),
  path = require("path"),
  fs = require("fs"),
  util = require('gulp-util'),
  images = require("images"),
  spritesmith = require('spritesmith'),
  fs = require('fs'),
  mkdirp = require("mkdirp"),
  cssClassName = require('./className'),
  Module = require('module');

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

function maximumIndex(obj) {
  var maximum = null;
  Object.keys(obj).forEach(function(key) {
    if (maximum == null || key > maximum) {
      maximum = null;
    }
  });
  return maximum;
}

function createRegisterSprite(opts) {
  var cwd = process.cwd();
  var deviceRatios = opts.deviceRatios;
  var spritePaths = opts.spritePaths;
  var imagePaths = opts.imagePaths;
  var maximumDeviceRatio = maximumIndex(deviceRatios) || 1;
  var stream = opts.stream;
  var doCollate = opts.doCollate;
  var tmp = opts.tmp;
  var base = opts.base;
  var file = opts.file;
  var cache = opts.cache;
  var all = opts.all;

  return function(opts) {
    var className = cssClassName(opts);
    if (!cache[className]) {
      cache[className] = opts;
      var imagePath = path.join(base, opts.src);
      var image = images(imagePath);
      var imageSize = image.size();
      var width = opts.width || (imageSize.width / maximumDeviceRatio);
      var height = opts.height || (imageSize.height / maximumDeviceRatio);

      imagePaths[imagePath] = {
        width: width,
        height: height,
        className: className
      };

      if (doCollate) {
        all.push(Promise.all(Object.keys(deviceRatios).map(
          function(deviceRatio) {
            var imgName = imageName(className, deviceRatio);
            var imgPath = path.join(cwd, tmp, imgName);
            var imgBuffer = resizeImage({
              className: className,
              deviceRatio: deviceRatio,
              image: images(imagePath)
            }, width, height);
            spritePaths[deviceRatio].push(imgPath);
            imagePaths[imgPath] = imagePaths[imagePath];
            return new Promise(function(resolve, reject) {
              mkdirp(path.dirname(imgPath), function(err) {
                if (err) reject(err);
                else fs.writeFile(imgPath, imgBuffer, function(err) {
                  (err ? reject : resolve)(err);
                });
              });
            })
          })));
      }
    }
    return className;
  }
}

var collate = module.exports = function(opts) {
  var urlPrefix = opts.urlPrefix || '/public';
  var deviceRatios = opts.deviceRatios;
  var spritePaths = Object.keys(deviceRatios).reduce(
    function(spritePaths, deviceRatio) {
      spritePaths[deviceRatio] = [];
      return spritePaths;
    }, {});
  var imagePaths = {};
  var cache = {};
  var doCollate = opts.collate;
  // If doCollate is false, no spritesheet is generated.
  // This would cause this function to run a lot faster.
  // Ideal for development mode.

  if (!deviceRatios[1]) {
    console.log("A device ratio of 1 must always specified.");
  }

  return through(
    function(file, encoding, cb) {
      var src = file.contents.toString();
      var count = 0;
      var all = [];
      var registerSprite = createRegisterSprite({
        base: opts.base || "",
        file: file,
        tmp: opts.tmp || ".tmp/",
        spritePaths: spritePaths,
        imagePaths: imagePaths,
        deviceRatios: deviceRatios,
        stream: this,
        cache: cache,
        doCollate: doCollate,
        all: all // every registerSprite call will push a promise into `all`.
      });
      var mod = new Module(file.path);
      var resolve = path.resolve
      var dirname = path.dirname(file.path);
      global.__className = registerSprite;
      var context = {
        module: mod,
        __filename: file.path,
        __dirname: path.dirname(file.path),
        __className: registerSprite,
        require: function(path) {
          try {
            return mod.require(resolve(dirname, path))  
          }
          catch(e) {
            return require(path)
          }
        },
      };
      vm.runInContext(src, vm.createContext(context), {
        filename: file.path
      });
      Promise.all(all).then(function() { cb() }, cb);
    }, 
    function(cb) {
      var stream = this;
      var css = [];
      if (!doCollate) {
        Object.keys(deviceRatios).forEach(function(deviceRatio) {
          if (deviceRatio == 1) {
            css.push(
              ".node-spritecss-bg {" +
                  "background-repeat: no-repeat;" +
              "}");
            Object.keys(imagePaths).forEach(function(spritePath) {
              var opts = imagePaths[spritePath];
              var className = opts.className;
              var width = opts.width;
              var height = opts.width;
              css.push("." + className.replace(" ", ".") + "{" +
                "background: url('" + urlPrefix + spritePath + "');" + 
                "width: " + width + "px;" +
                "height: " + height + "px;" +
                "background-size: " + width + "px " + height + "px;" +
                "display: inline-block;" +
              "}");
            });
          }
          else {
            css.push(
              "@media(-webkit-min-device-pixel-ratio: " + deviceRatio + 
                "), (min-resolution: "+ (BASE_DPI * deviceRatio)+"dpi) {\n");
            Object.keys(imagePaths).forEach(function(spritePath) {
              var opts = imagePaths[spritePath];
              var className = opts.className;
              css.push("." + className.replace(" ", ".") + "{" +
                "background-image: url('" + urlPrefix + spritePath + "');" + 
              "}");
            });
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
      }
      else {
        Promise.all(Object.keys(deviceRatios).map(function(deviceRatio) {
          return new Promise(function(resolve, reject) {
            spritesmith({src: spritePaths[deviceRatio]}, function(err, result) {
              var imgName = deviceRatios[deviceRatio];
              if (err) console.error(err);
              stream.push(new util.File({
                cwd: "", 
                base: "", 
                path: imgName,
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
                  var opts = imagePaths[key];
                  var className = opts.className;
                  var coordinate = result.coordinates[key];
                  css.push("." + className.replace(" ", ".") + "{" +
                    "background-position: -" + coordinate.x + "px -" + 
                      coordinate.y + "px;" + 
                    "width: " + coordinate.width + "px;" +
                    "height: " + coordinate.height + "px;" +
                    "display: inline-block;" +
                  "}");
                });
              }
              else {
                css.push(
                "@media(-webkit-min-device-pixel-ratio: " + deviceRatio + 
                  "), (min-resolution: "+(BASE_DPI * deviceRatio)+"dpi) {\n" +
                    ".node-spritecss-bg {" +
                        "background-image: url('" + urlPrefix + imgName + 
                          "');" + 
                    "}\n"+ 
                "}");
              }
              resolve();
            });
          });
        })).then(function() {
          stream.push(new util.File({
            cwd: "", 
            base: "", 
            path: opts.cssName,
            contents: new Buffer(css.join("\n"))
          }));
          cb();
        }, console.error);            
      }
  });
}