# node-spritecss #

Generate a PNG spritesheet and CSS stylesheet for each image declared in
your javascript browserified javascript files.

It was designed with the use of React in mind but can be used without it.


## Example ##

    .node-spritecss-bg {background-image: url('/public/sprite@1x.png');background-size: 644px 380px;background-repeat: no-repeat;}
    .node-spritecss-bg.node-spritecss-background-jpg-644-317{background-position: -0px -0px;width: 644px;height: 317px;display: inline-block;}
    .node-spritecss-bg.node-spritecss-search-jpg-63-63{background-position: -0px -317px;width: 63px;height: 63px;display: inline-block;}
    .node-spritecss-bg.node-spritecss-logo-png-49-49{background-position: -126px -317px;width: 49px;height: 49px;display: inline-block;}
    .node-spritecss-bg.node-spritecss-graduateHatCert-png-63-63{background-position: -63px -317px;width: 63px;height: 63px;display: inline-block;}
    .node-spritecss-bg.node-spritecss-graduateCert-png-17-17{background-position: -175px -317px;width: 17px;height: 17px;display: inline-block;}
    @media(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    .node-spritecss-bg {background-image: url('/public/sprite@2x.png');}
    }

Let's say you have the following directory structure for your project:

`MyProject/gulpfile.js`
`MyProject/src/images/logo.png`
`MyProject/src/jsfile.js`
`MyProject/src/jsfile2.js`
`MyProject/tmp/public/client.js` // Compiled file included in script tag. It should have no JSX tags or es6 remaining.

And you use the following configuration for `node-spritecss`.

### In your JSX File ##

    var Sprite = require('node-spritecss');

    // Statically declared image.
    var SmallLogoImage = Sprite.className({
      src: "logo.png", 
      width: 50, 
      height: 50});
    // Omit `width` and `height` to use the image's width and height divided by
    // your highest target device ratio (see example gulpfile.js below).

    // Sprites with same image but different sizes will be rendered twice
    // in the sprite sheet, at different sizes. This plugin does not rely
    // on the CSS background-size.
    var BigLogoImage = Sprite.className({
      src: "logo.png", 
      width: 100, 
      height: 100});

    // Create some JSX as usual, substitute the generated class name.
    var Logo = (<a href="">
          <img className={SmallLogoImage}></img>
        </a>);
    var BigLogo = (<a href="">
          <img className={BigLogoImage}></img>
        </a>);

### In your gulpfile.js ##

    var collate = require('node-spritecss/collate');
    //...
    // `bundle` is the task to reactify and browserify your javascripts.
    gulp.task('sprite', ['bundle'], function() {
      return gulp.src(['./tmp/public/client.js'])
        .pipe(collate({
          base: "./src/images", // Base directory relative to src specified by Sprite.className
          deviceRatios: { // Specify the output image for each device ratio you wish to target.
            1: "sprite@1x.png", // Device ratio 1 is mandatory.
            1.5: "sprite@1.5x.png", // For high resolution screens.
            2: "sprite@2x.png", // For retina screens.
          },
          collate: true, // Set to false for development. 
          // true means all CSS classes share one sprite sheet.
          // if true, the intermediate images saved in `./src/.tmp/` as specified by `tmp`.
          // false means one CSS class = one sprite sheet with one image. 
          // if false, the images saved in `./tmp/public` as specified by `gulp.dest`.
          cssName: "sprite.css", // The output css file's name.
          tmp: "./.tmp", // Temporary folder relative to gulpfile.js to store resized images.
           // You will have to add another task to remove this folder later.
          urlPrefix: "/public/",
        }))
        .pipe(gulp.dest('./tmp/public')); // Save the css and spritesheets in this folder.
    });

`node-spritecss` will create two files:

`MyProject/tmp/public/sprite.png`
`MyProject/tmp/public/sprite.css`

Which you can include in your base html file, and the classes you used in the
above JSX file will reference to sprites defined `sprite.css`.

