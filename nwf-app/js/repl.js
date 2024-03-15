// Initialization
//var directory = nwf.io.Directory.appCommonSaveDirectory.systemPath;
var directory = nwf.io.Directory.appTempDirectory.systemPath;
var dir = new nwf.io.Directory(directory);

var lastProcessedTimestamp = 0;

// Helper to prepend log messages to an <ul> with id "log"
/*function logMessage(message) {
    try {
        var ul = document.getElementById("log");
        var li = document.createElement("li");
        message = new Date().toISOString() + ": " + message;
        li.appendChild(document.createTextNode(message));
        if (ul.firstChild) {
            ul.insertBefore(li, ul.firstChild);
        } else {
            ul.appendChild(li);
        }
    } catch (error) {
        // Fallback in case logging fails
        console.error("Logging failed: ", error);
    }
}

logMessage('JS initialized');
*/
logMessage('repl.js loaded');

window.onerror = logMessage;

// Save "Hello World" file as an initial test
function saveHelloWorld() {
    var timestamp = Math.floor(Date.now() / 1000); // UNIX timestamp in seconds
    var filename = timestamp + '-hello-world.txt';
    var data = "Hello world!";
    saveFile(filename, data, function() {
        logMessage("Saved 'Hello World' file successfully.");
    }, function() {
        logMessage("Failed to save 'Hello World' file.");
    });
}

// Save File function (simplified from provided code)
function saveFile(filename, data, readyFunc, failFunc) {
    var file = new nwf.io.File(filename, dir);
    var blob = new Blob([data], {type: 'text/plain'});
    file.addEventListener(nwf.events.IOEvent.SAVE_COMPLETE, function(evt) {
        evt.target.removeEventListener(nwf.events.IOEvent.SAVE_COMPLETE, arguments.callee);
        evt.target.removeEventListener(nwf.events.IOEvent.ERROR, arguments.callee);
        readyFunc();
    });
    file.addEventListener(nwf.events.IOEvent.ERROR, function(evt) {
        evt.target.removeEventListener(nwf.events.IOEvent.SAVE_COMPLETE, arguments.callee);
        evt.target.removeEventListener(nwf.events.IOEvent.ERROR, arguments.callee);
        failFunc();
    });
    file.save(blob);
}

function 	saveBlob(filename, blob, readyFunc, failFunc) {
    var file = new nwf.io.File(filename, dir);

    file.addEventListener(nwf.events.IOEvent.SAVE_COMPLETE, function(evt) {
        evt.target.removeEventListener(nwf.events.IOEvent.SAVE_COMPLETE, arguments.callee);
        evt.target.removeEventListener(nwf.events.IOEvent.ERROR, arguments.callee);
        readyFunc();
    });
    file.addEventListener(nwf.events.IOEvent.ERROR, function(evt) {
        evt.target.removeEventListener(nwf.events.IOEvent.SAVE_COMPLETE, arguments.callee);
        evt.target.removeEventListener(nwf.events.IOEvent.ERROR, arguments.callee);
        failFunc();
    });
    file.save(blob);
}

// Process, or execute, a single file.
function processRequest(file) {
		var fileNameParts = file.fileName.split('-');
		var timestamp = parseInt(fileNameParts[0], 10);
		//logMessage(file.fileName + ", timestamp: " + timestamp);
		if (fileNameParts[1] !== 'request' || lastProcessedTimestamp >= timestamp) {
			return;
		}
		lastProcessedTimestamp = timestamp;
		logMessage("Attempting to read & evaluate " + file.fileName);
		readFile(file.fileName + '.' + file.fileExtension, function(data) {
			  try {
			      //logMessage(data);
			      var output = JSON.stringify(eval(data)); //  , getCircularReplacer()); // Evaluate the file content
			      var responseFilename = Math.floor(Date.now() / 1000) + '-response.txt';
			      saveFile(responseFilename, output, function() {
			          logMessage("Response saved as " + responseFilename);
			      }, function() {
			          logMessage("Failed to save response for " + file.fileName);
			      });
			      lastProcessedTimestamp = timestamp; // Update last processed timestamp
			  } catch (error) {
			      logMessage("Error processing " + file.fileName + ": " + error.toString());
			  }
		}, function(evt) {
			  logMessage("Failed to read with code:" + evt.errorID);
		});
}
					      /*function getCircularReplacer() {
									const ancestors = [];
									return function (key, value) {
										if (typeof value !== "object" || value === null) {
											return value;
										}
										// `this` is the object that value is contained in,
										// i.e., its direct parent.
										while (ancestors.length > 0 && ancestors.at(-1) !== this) {
											ancestors.pop();
										}
										if (ancestors.includes(value)) {
											return "[Circular]";
										}
										ancestors.push(value);
										return value;
									};
								}*/

// Read and Process Files
function readAndProcessFiles() {
    //var tempDirectory = new nwf.io.Directory(directory);
    var files = dir.listFiles();
    //logMessage("Poll.");
    for (var i = 0; i < files.length; i++) {
        processRequest(files[i]);
    }
}

// Read File function (simplified from provided code)
function readFile(filename, readyFunc, failFunc) {
    var file = new nwf.io.File(filename, dir);
    file.addEventListener(nwf.events.IOEvent.READ_COMPLETE, function(evt) {
        //logMessage('read complete, opening ')
        var fileReader = new FileReader();
        fileReader.onloadend = function(e) {
            if (fileReader.error) {
                failFunc(evt);
            } else {
                readyFunc(e.target.result);
            }
        };
        fileReader.readAsText(evt.data);
    });
    file.addEventListener(nwf.events.IOEvent.ERROR, function(evt) {
        failFunc(evt);
    });
    file.read();
}

// Initial setup
saveHelloWorld();
setInterval(readAndProcessFiles, 500); // Poll the directory every 500 ms
