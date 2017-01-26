var path = require('path');
var extend = require('extend');

var css = require('css');

var spriterUtil = require('./spriter-util');
var mapOverStylesAndTransformBackgroundImageDeclarations = require('./map-over-styles-and-transform-background-image-declarations');

var backgroundURLMatchAllRegex = new RegExp(spriterUtil.backgroundURLRegex.source, "gi");


// Replace all the paths that need replacing
function transformFileWithSpriteSheetData(vinylFile, coordinateMap, pathToSpriteSheetFromCSS,  /*optional*/includeMode, /*optional*/isSilent, /*optional*/outputIndent, /*optional*/resourceRoot, /*optional*/spriteProperties) {
	includeMode = includeMode ? includeMode : 'implicit';
	isSilent = (isSilent !== undefined) ? isSilent : false;
	outputIndent = outputIndent ? outputIndent : '\t';

	// Clone the declartion to keep it immutable
	var resultantFile = vinylFile.clone();

	if(resultantFile) {

		var styles = css.parse(String(resultantFile.contents), {
			'silent': isSilent,
			'source': vinylFile.path
		});

		styles = mapOverStylesAndTransformBackgroundImageDeclarations(styles, includeMode, function(declaration) {

			var coordList = [];
			var sizeList = [];
            var spriteWidth = spriteProperties && spriteProperties.width;
            var spriteHeight = spriteProperties && spriteProperties.height;

			declaration.value = spriterUtil.matchBackgroundImages(declaration.value, function(imagePath) {

				var imageFullPath;

				if (resourceRoot != null && imagePath.substr(0, 1) == '/') {
                    imageFullPath = path.join(resultantFile.cwd, resourceRoot, imagePath);
				} else {
                    imageFullPath = path.join(path.dirname(resultantFile.path), imagePath);
				}

				var coords = coordinateMap[imageFullPath];
				//console.log('coords', coords);

				// Make sure there are coords for this image in the sprite sheet, otherwise we won't include it
				if(coords) {
					if (spriteProperties) {
						var xDivider = spriteWidth - coords.width;
						var yDivider = spriteHeight - coords.height;

						if (xDivider == 0) { xDivider = 1; }
						if (yDivider == 0) { yDivider = 1; }

						coordList.push((Math.abs(coords.x/xDivider) * 100) + '% ' + (Math.abs(coords.y/yDivider)) * 100 + '%');
					} else {
						coordList.push("-" + coords.x + "px -" + coords.y + "px");
					}

					if (declaration.meta.size) {
						var blockWidth = declaration.meta.size.width;
						var blockHeight = declaration.meta.size.height;

						if (blockWidth == null) {
							blockWidth = blockHeight / spriteHeight * spriteWidth;
						} else if (blockHeight == null) {
                            blockHeight = blockWidth / spriteWidth * spriteHeight;
						}

                        sizeList.push(
                        	((spriteWidth / blockWidth) * (blockWidth / coords.width) * 100) + '% '
							+ ((spriteHeight / blockHeight) * (blockHeight / coords.height) * 100) + '%'
						);
					} else {
						sizeList.push(spriteWidth + 'px ' + spriteHeight + 'px');
					}

					// If there are coords in the spritemap for this image, lets use the spritemap
					return pathToSpriteSheetFromCSS;
				}

				return imagePath;
			});

			return {
				'value': declaration,
				/* */
				// Add the appropriate background position according to the spritemap
				'insertElements': (function() {
					if(coordList.length > 0) {
						return  [
							{
								type: 'declaration',
								property: 'background-position',
								value: coordList.join(', ')
							},
							{
								type: 'declaration',
								property: 'background-size',
								value: sizeList.join(', ')
							}
						];
					}
				})()
				/* */
			};
		});

		//console.log(styles.stylesheet.rules[0].declarations);

		// Put it back into string form
		var resultantContents = css.stringify(styles, {
			indent: outputIndent
		});
		//console.log(resultantContents);
		resultantFile.contents = new Buffer(resultantContents);
	}

	return resultantFile;
}

module.exports = transformFileWithSpriteSheetData;