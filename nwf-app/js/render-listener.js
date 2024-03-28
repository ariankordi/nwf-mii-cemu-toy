logMessage('render-listener.js is loaded');


var directory = nwf.io.Directory.appTempDirectory.systemPath;
var dir = new nwf.io.Directory(directory);

var lastProcessedTimestamp = 0;


var blankBlob = new Blob([]);

// check for mii library
try {
	  var miiLibJson = JSON.stringify(nwf.mii);
	  logMessage("Mii extension: " + miiLibJson);
} catch (error) {
	  logMessage("Mii extension is not accessible: " + error);
}

if(nwf.amiibo) {
	// make a global amiibo reader for convenience
	window.amiiboReader = nwf.amiibo.Reader.getInstance();

	function onFigureDetectPrintDebug(evt) {
		amiiboReader.getInfo(function(result, data) {
			//logMessage(JSON.stringify(result));
			window.amiibo = data;
			logMessage(JSON.stringify(data));
		});
	}

	amiiboReader.addEventListener(nwf.events.AmiiboEvent.FIGURE_DETECTED, onFigureDetectPrintDebug);

	// start listening but you can bind to this yourself too if you want
	amiiboReader.startDetect();
}


// HACK!

/*function createPNGBlob(canvas) {
    var dataURL = canvas.toDataURL('image/png');
    var data = atob(dataURL.substring('data:image/png;base64,'.length));
    var u8Array = new Uint8Array(data.length);
    for (var i = 0, len = data.length; i < len; ++i) {
        u8Array[i] = data.charCodeAt(i);
    }
    var blob = new Blob([u8Array.buffer], { type: 'image/png' });
    return blob;
}

// so you can change render settings internally
window.renderSettings = {
    show_body: true,
    mipmap: true,
    // all unused now
    tex_resolution: 512,
    size: 512,
    windowSize: 512
};
*/
/* to write file but we are not writing files anymore
window.onFigureDetect = function(evt) {
    var tcanvas = document.createElement('canvas');
    tcanvas.width = window.renderSettings.windowSize;
    tcanvas.height = window.renderSettings.windowSize;
    var ul = document.getElementById("log");
    var li = document.createElement("li");
    li.appendChild(tcanvas);
    ul.insertBefore(li, ul.firstChild);
    amiiboReader.getInfo(function(result, data) {
        // indicate figure is read and we are ready for a new one
        /*var filename = Math.floor(Date.now() / 1000) + '-ready-for-new-nfp';
        new nwf.io.File(filename, dir).save(blankBlob);

        window.mii = data.mii;
        data.mii.createIcon(function(img) {
            var ctx = tcanvas.getContext('2d', carg);
            ctx.drawImage(img, 0, 0, tcanvas.width, tcanvas.height);

            var filename = Math.floor(Date.now() / 1000) + '-render-finish';
            new nwf.io.File(filename, dir).save(blankBlob);
            /*logMessage('render to frompngblob');
            setTimeout(function() {
                var blob = createPNGBlob(tcanvas);
                saveBlob(Math.floor(Date.now() / 1000) + '-render.png', blob, logMessage, logMessage);
            }, 3000)

        }, window.renderSettings);
    })
};
*/

window.utf16ToArray = function(utf16Str) {
    // Initialize a buffer to hold our decoded binary data
    var buffer = new Array(utf16Str.length * 2);
    for (var i = 0, strLen = utf16Str.length; i < strLen; i++) {
        // Extracting each character code (16 bits)
        var code = utf16Str.charCodeAt(i);
        // Splitting the 16 bits into two 8-bit numbers
        buffer[i * 2 + 1] = code & 0xFF; // Upper 8 bits
        buffer[i * 2] = code >> 8; // Lower 8 bits, shifted down
    }
    return buffer;
}

window.drawBytesToCanvas = function(buffer, ctx) {
    //var ctx = canvas.getContext('2d');
    // each pixel is two bytes, hence we can halve the size
    var imageData = ctx.createImageData(buffer.length / 2, 1); // Create imageData for 1 row

    // iterate two pixels and two bytes at a time
    for (var i = 0; i < buffer.length; i += 2) {
        var pixelIndex = i / 2;
        imageData.data[pixelIndex * 4] = buffer[i]; // R component from the byte array
        imageData.data[pixelIndex * 4 + 1] = buffer[i + 1]; // G component as second byte
        // B component is 0 by default.
        imageData.data[pixelIndex * 4 + 3] = 255; // Alpha channel set to 255 (fully opaque)
    }

    ctx.putImageData(imageData, 0, 0); // Place the imageData on the canvas at the top left corner
}


window.tcanvas = document.createElement('canvas');
window.tcanvas.style.position = 'absolute';
window.tcanvas.style.top = '0px';
window.tcanvas.style.left = '0px';
var ul = document.getElementById("log");
var li = document.createElement("li");
li.appendChild(tcanvas);
ul.insertBefore(li, ul.firstChild);

// maps expressions. yes
var expressionToConstMap = [1, 16, 1024, 16384, 65536, 256, 2048, 4, 65536, 128, 32, 2, 512, 8192, 8, 1, 131072, 32768, 128, 262144, 16, 4096, 64, 8, 1];

/*
{
    // null, zero: 1,
    "SURPRISE": 16,
    "SURPRISE_OPEN_MOUTH": 1024,
    "WINK_LEFT_OPEN_MOUTH": 16384,
    "LIKE": 65536,
    "ANGER_OPEN_MOUTH": 256,
    "BLINK_OPEN_MOUTH": 2048,
    "ANGER": 4,
    "LIKE_WINK_LEFT": 65536,
    "HAPPY": 128,
    "BLINK": 32,
    "SMILE": 2,
    "SORROW_OPEN_MOUTH": 512,
    "WINK_RIGHT": 8192,
    "SORROW": 8,
    "NORMAL": 1,
    "LIKE_WINK_RIGHT": 131072,
    "WINK_RIGHT_OPEN_MOUTH": 32768,
    "SMILE_OPEN_MOUTH": 128,
    "FRUSTRATED": 262144,
    "SURPRISED": 16,
    "WINK_LEFT": 4096,
    "OPEN_MOUTH": 64,
    "PUZZLED": 8
}

    'normal',
	'smile',
	'anger',
	'sorrow',
	'surprise',
	'blink',
	'normal_open_mouth', -> open_mouth
	'smile_open_mouth',
	'anger_open_mouth',
	'surprise_open_mouth',
	'sorrow_open_mouth',
	'blink_open_mouth',
	'wink_left',
	'wink_right',
	'wink_left_open_mouth',
	'wink_right_open_mouth',
	'like_wink_left',
	'like_wink_right',
	'frustrated',
*/

window.byteArrayToRenderParams = function(buffer) {
    // Now, we convert the binary data back into the struct's fields
    // Assuming the buffer is in the correct order and endianess
    return {
        MiiDataHash: ((buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3]) >>> 0,
        Resolution: ((buffer[4] << 8) | buffer[5]) >>> 0,
        Mode: buffer[6],
        Expression: buffer[7],
        BackgroundR: buffer[8],
        BackgroundG: buffer[9],
        BackgroundB: buffer[10],
        Scale: buffer[11],
        // because buffer can end before these are defined
        // NOTE: no longer optional because we are padding it out
        HorizontalTotal: /*buffer.length > 12 ? */buffer[12],// : 0,
        HorizontalChunk: /*buffer.length > 13 ? */buffer[13],// : 0,
        // texture resolution override, quad multiple
        // this is a fancy way of saying it's (res / 4) so 1024(max)=256, fits in uint8
        //TexResOverrideQMul: buffer.length > 14 ? buffer[14] : 0
    };
}
// assumed length of buffer which will be padded
var bufferLength = 14;

window.dynamicGetInfoFunction = function(result, data) {
    // result is supposed to indicate an error apparently...
    if(result !== nwf.amiibo.Error.NONE) {
        logMessage('AMIIBO ERROR!!!: ' + result);
        return;
    }
    // TODO: remove all window sets soon
    window.mii = data.mii;
    // access it in the console
    window.name = data.name;
    // NOTE: use static length of 14 in case string is not fully complete
    // .. otherwise, it may cause comparison issues even if all are not used

    // convert utf-16be nfp name to buffer
    var buffer = utf16ToArray(data.name);
    // pad out buffer
    for (var i = 0; i < 16; i++) {
        if(buffer[i] !== undefined) {
            continue;
        }
        // add zeroes where they don't exist
        buffer[i] = 0;
    }
    //logMessage(buffer);

    // extract parameters out of buffer ( has to be padded out ...)
    var params = byteArrayToRenderParams(buffer);

    // flag if resolution or scale are invalid
    // minimum 16 resolution
    if(params.Resolution < 16 || params.Resolution > 2048) {
        throw new Error('Resolution value of '+ params.Resolution +' is out of range!');
    }
    // scale probably SHOULD NOT go higher than like.. 4? 8? 16? but 64 is super liberal
    if(params.Scale < 1 || params.Scale > 64) {
        throw new Error('Scale value of '+ params.Scale +' is out of range!');
    } else if(params.Scale > 8) {
        logMessage('Excessively high scale: '+ params.Scale);
    } else if(params.Scale > 4) {
        logMessage('Diminishingly high scale: '+ params.Scale);
    }
    // i THINK this is the max for expressions? and 24 is normal
    if(params.Expression > 24) {
        throw new Error('Invalid expression/out of range: ' + params.Expression);
    }
    var expressionValue = expressionToConstMap[params.Expression];

    // set window size according to scale
    var windowSize = params.Resolution / params.Scale;
    // TODO: Expression, chunking
    // this will do in chunking's absence.
    params.HorizontalChunk && (params.TexResOverrideQMul = params.HorizontalChunk);

    tcanvas.width = windowSize; tcanvas.height = windowSize;
    // no alpha so opacity is always 100
    var bgColor = 'rgba('+params.BackgroundR+', '+params.BackgroundG+', '+params.BackgroundB+', 100)';

    logMessage('Preparing to render: ' + data.mii.name);

    data.mii.createIcon(function(img) {
        /*var ul = document.getElementById("log");
        var li = document.createElement("li");
        li.appendChild(img);
        ul.insertBefore(li, ul.firstChild);
        img.onload = function() {
            nwf.utils.log('img.onload');
        }*/
        var ctx = tcanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, tcanvas.width, tcanvas.height);

        // draw marker on top of image
        drawBytesToCanvas(buffer, ctx);

        var filename = Math.floor(Date.now() / 1000) + '-render-finish';
        new nwf.io.File(filename, dir).save(blankBlob);
        nwf.utils.log('render-finish written');
    }, {
        // params.Mode higher is TRUEY (greater than 0) means FACE ONLY
        show_body: (params.Mode ? false : true),
        mipmap: true,
        size: params.Resolution,
        tex_resolution: params.TexResOverrideQMul ? (params.TexResOverrideQMul * 4)
                    : (params.Resolution > 1024 ? 1024 : params.Resolution),
        background_color: bgColor,
        expression: expressionValue,
    });
};

window.onFigureDetect = function() {
    amiiboReader.getInfo(dynamicGetInfoFunction);
};
amiiboReader.addEventListener(nwf.events.AmiiboEvent.FIGURE_DETECTED, onFigureDetect);
