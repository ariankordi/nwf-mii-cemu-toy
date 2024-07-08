// Select elements based on their names and ids
const resolutionNumber = document.getElementsByName('width')[0];
const widthSlider = document.getElementById('resolution-slider');
const bgColor = document.getElementsByName('bgColor')[0];
const transparentCheckbox = document.getElementById('transparent-checkbox');

const bgDefault = '#00ff00'//bgColor.value;

// Update the width slider when the resolution number is changed
resolutionNumber.addEventListener('input', function() {
  widthSlider.value = this.value;
});

// Update the resolution number when the width slider is changed
widthSlider.addEventListener('input', function() {
  resolutionNumber.value = this.value;
});

// When the transparent-checkbox is checked, change the background color to #00ff00
transparentCheckbox.addEventListener('change', function() {
  if(this.checked) {
    bgColor.value = bgDefault;
    this.disabled = true;
  } else if(bgColor.value === bgDefault) {
    // TODO: you may consider changing bg by one
    // so you can still have a green background
    this.checked = true;
    this.disabled = true;
  }
});

// When the background color is changed to #00ff00, check the transparent-checkbox
// Note: This also unchecks the checkbox if the color is changed to anything other than #00ff00
bgColor.addEventListener('input', function() {
  if(this.value.toLowerCase() === bgDefault) {
    transparentCheckbox.checked = true;
    transparentCheckbox.disabled = true;
  } else {
    transparentCheckbox.checked = false;
    transparentCheckbox.disabled = false;
  }
});

const scaleInput = document.getElementsByName('scale')[0];
const realMax = 1080;
// Function to update max resolution based on scale
function updateMaxResolution() {
  const scale = parseInt(scaleInput.value, 10);
  const maxResolution = realMax / scale;

  // Adjust current values if they exceed the new max
  if(widthSlider.value > maxResolution) {
    widthSlider.value = maxResolution;
    //debugger;
    resolutionNumber.value = maxResolution;
  }

  widthSlider.max = maxResolution;
  resolutionNumber.max = maxResolution;
}

// Session ID is set once and used for the lifespan of the page
const sessionIDInput = document.getElementById('errorSessionID');
// Set a unique request ID each time a request is sent
const requestIDInput = document.getElementById('errorRequestID');
sessionIDInput.value = 'sess-' + Math.random().toString(36).substr(2, 9); // Generate a random session ID once

const errorResponses = new Map(); // Temporarily store error messages

let evtSource = null;
// Function to ensure the SSE connection is established
function connectErrorReportingSSE() {
  // Only attempt to connect if not already connected or in an attempt to reconnect
  if(!evtSource || evtSource.readyState === EventSource.CLOSED) {
    evtSource = new EventSource('/error_reporting?errorSessionID='
                                + sessionIDInput.value);

    evtSource.onmessage = function(event) {
      // Handle incoming error messages by updating the DOM or storing them temporarily
      const error = JSON.parse(event.data);
      //console.log(error)
      const listItem = document.querySelector('[data-error-request-id="' + error.requestID + '"]');
      if(listItem) {
        listItem.textContent = error.message;
        const listImg = listItem.querySelector('img');
        if(listImg) listItem.parentElement.removeChild(listImg);
      } else {
        errorResponses.set(error.requestID, error.message);
      }
      if(errorResponses.size > 10) {
        // Ensure we don't exceed 10 stored messages
        const firstKey = errorResponses.keys().next().value;
        errorResponses.delete(firstKey);
      }
    };

    evtSource.onerror = function() {
      console.error('EventSource failed. No further attempts to reconnect will be made unless a request is sent.');
      evtSource.close();
    };
  }
}

// Listen for changes in the scale input to update max resolution
scaleInput.addEventListener('input', updateMaxResolution);

// Initial setup - apply the correct maximums based on the initial scale value
updateMaxResolution();

// assumes there is only ONE form on the page or at least the one we want is the first one
const form = document.forms[0];
const resultList = document.getElementById('results');

const submitButton = document.getElementById('submit');

let formSubmitting = false;

form.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent the default form submission via HTTP
  formSubmitting = true;
  submitButton.disabled = true; // Disable the button
  submitButton.setAttribute('value', submitButton.getAttribute('data-value'));

  if(nnid.value.replace(/[_\-.]/g, '').toLowerCase() === 'aknet10'
     && arianHandler !== undefined) {
    try {
      arianHandler();
    } catch(error) {
      /*
      const errorDiv = document.createElement('div');
      errorDiv.textContent = error.message;
      errorDiv.style.color = 'red'; // Set text color to red
      document.body.insertBefore(errorDiv, document.body.firstChild); // Insert at the beginning of the body
      submitButton.disabled = false; // Re-enable the button
      submitButton.removeAttribute('value');
      */
      const errorLiOriginal = document.getElementsByClassName('load-error');
      // get last error li, the original
      const errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
      errorLi.textContent = error.message;
      errorLi.style.display = '';

      formSubmitting = false;
      submitButton.disabled = false; // Re-enable the button
      submitButton.removeAttribute('value');

      resultList.insertBefore(errorLi, resultList.firstChild); // Insert at the top
    } finally {
      return;
    }
  }

  // Generate a new request ID for each submission
  requestIDInput.value = 'req-' + Math.random().toString(36).substr(2, 9);

  // Ensure SSE is connected when sending a request
  connectErrorReportingSSE();

  /*
  // Check if file input is present and has a file
  if(fileInput && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      // When file is read, replace/add the 'data' parameter with the file content in Base64
      const base64Data = e.target.result.split(',')[1]; // Remove the 'data:;base64,' part
      const formData = new FormData(form);
      formData.set('data', base64Data); // Replace or add 'data' parameter with the file's Base64 content
      const params = new URLSearchParams([...formData.entries()]).toString();
      createAndAppendImage(params);
    };
    reader.readAsDataURL(fileInput.files[0]);
    return;
  }
  */

  // Proceed normally if no file is selected
  const formData = new FormData(form);
  const params = new URLSearchParams([...formData.entries()]).toString();
  // more compatible? version taken from: https://stackoverflow.com/a/43000398
  // expand the elements from the .entries() iterator into an actual array
  /*const paramsParts = [...formData.entries()]
                     // transform the elements into encoded key-value-pairs
                     .map(e => encodeURIComponent(e[0]) + "=" + encodeURIComponent(e[1]));
  const params = paramsParts.join('&');
  */
  createAndAppendImage(params);

  function createAndAppendImage(params) {
    // request image from form action
    const imageBase = form.action;

    const imageUrl = imageBase + '?' + params;

    // Create and append the <img> element
    const img = document.createElement('img');
    img.src = imageUrl;
    img.onerror = function(e) {
      // Handle image loading error
      const errorLiOriginal = document.getElementsByClassName('load-error');
      // get last error li, the original
      const errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
      // Generic error message unless overwritten by SSE message
      errorLi.setAttribute('data-error-request-id', requestIDInput.value);
      const errorResponse = errorResponses.get(requestIDInput.value);
      if(errorResponse !== undefined)
         errorLi.textContent = errorResponse;

      errorLi.style.display = '';

      formSubmitting = false;
      submitButton.disabled = false; // Re-enable the button
      submitButton.removeAttribute('value');

      if(errorResponse === undefined)
          errorLi.appendChild(img); // Append the <img> inside of the the error li
      resultList.insertBefore(errorLi, resultList.firstChild); // Insert at the top
    };
    img.onload = function() {
      // Re-enable the button upon successful image load
      formSubmitting = false;
      submitButton.disabled = false;
      submitButton.removeAttribute('value');

      img.className += ' fade-in'; // Add the fade-in class
      // Insert the new <li> at the top of the list
      const li = document.createElement('li');
      li.appendChild(img); // Append the <img> to the <li>
      resultList.insertBefore(li, resultList.firstChild);
      // remove on successful load
      const tutorial = document.getElementById('tutorial');
      if(tutorial) tutorial.parentElement.removeChild(tutorial);
    };
  }
});

function extractMiiNameFromFFSD(data) {
  // Extract UTF-16 LE Mii name starting at 0x1A
  const startOffset = 0x1A;
  const nameLength = 0x14;
  // Find the position of the null terminator (0x00 0x00)
  let endPosition = startOffset;
  while(endPosition < startOffset + nameLength) {
    if(data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16 LE)
  }
  const utf16leBytes = data.slice(0x1A, endPosition);
  // NOTE: TextDecoder only works on newish browsers
  // despite the rest of this script using pre-ES6 syntax
  // TODO: TEST ON OLDER BROWSERS!!!!!!!!!!
  const utf16leMiiName = new TextDecoder('utf-16le').decode(utf16leBytes);
  return utf16leMiiName;
}

// file type input
const fileInput = document.getElementById('file');
const fileDataInput = document.getElementById('file-data');
const fileLoaded = document.getElementById('file-loaded');
// select an error element that is visible
// visible = does not have (display: )none
const errorTextQuery = '[id^="data-error-"]:not([style*="none"]';

// handle adding form input on file input, or fail
fileInput.addEventListener('input', function() {
  if(!fileInput || !fileInput.files[0]) {
    return;
  }
  // remove mii name and input value
  fileLoaded.style.display = 'none';
  fileDataInput.value = '';
  // clear validity
  fileInput.setCustomValidity('');
  const reader = new FileReader();
  reader.onload = function(e) {
    // When file is read, replace/add the 'data' parameter with the file content in Base64
    const base64Data = e.target.result.split(',')[1]; // Remove the 'data:;base64,' part
    // decode so we can verify it and read the mii name
    const data = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // this function will handle errors, showing and returning false
    // if there are no errors it should pass tho
    if(!checkFFSDSizeAndCRCPass(data)) {
      // remove file to invalidate the form
      //fileInput.value = '';
      const errorText = document.querySelector(errorTextQuery).textContent;
      if(errorText) fileInput.setCustomValidity(errorText);
      //fileInput.setCustomValidity('foobar');
      // do not mark success
      return;
    }
    // assuming success
    fileDataInput.value = base64Data;
    // extract name and show loaded text
    fileLoaded.style.display = '';
    fileLoaded.firstElementChild.textContent =
                 extractMiiNameFromFFSD(data);
  };
  reader.readAsDataURL(fileInput.files[0]);
  return;
});

const dataLoaded = document.getElementById('data-loaded');
const dataInput = document.getElementById('data');

// same but for base64 mii data
dataInput.addEventListener('input', function() {
  // remove mii name
  dataLoaded.style.display = 'none';
  dataInput.setCustomValidity('');
  // ignore if is not base64
  if(dataInput.validity.patternMismatch) {
    return;
  }
  // TODO TRY AND CATCH THIS BLOCK
  // decode so we can verify it and read the mii name
  const data = Uint8Array.from(atob(dataInput.value), c => c.charCodeAt(0));
  // this function will handle errors, showing and returning false
  // if there are no errors it should pass tho
  if(!checkFFSDSizeAndCRCPass(data)) {
    // remove file to invalidate the form
    const errorText = document.querySelector(errorTextQuery).textContent;
    if(errorText) dataInput.setCustomValidity(errorText);
    // do not mark success
    return;
  }
  // assuming success
  // extract name and show loaded text
  dataLoaded.style.display = '';
  dataLoaded.firstElementChild.textContent =
               extractMiiNameFromFFSD(data);
  return;
});

const inputTypeSelect = document.getElementById('input_type');

function updateVisibility() {
  // hide all file statuses/errors whenever you switch input types
  document.querySelectorAll('[id^="data-error-"]').forEach(function(element) {
      element.style.display = 'none';
  });

  // Retrieve the selected value from the dropdown.
  const selectedValue = inputTypeSelect.value;

  // Loop through all options in the dropdown.
  Array.from(inputTypeSelect.options).forEach(option => {
    const group = document.getElementById(option.value + '-group');
    // Skip if no group element is found.
    if(!group) return;

    // Determine if this group should be visible.
    const isVisible = option.value === selectedValue;
    group.style.display = isVisible ? '' : 'none';

    // Update all input elements within the group.
    Array.from(group.getElementsByTagName('input')).forEach(input => {
      // if it's NOT visible, disable it
      input.disabled = !isVisible;
      //input.required = isVisible;
      // fire input trigger to invoke validation
      if(isVisible) input.dispatchEvent(new Event('input'));
    });
  });
}


// Initially call the function to set the correct state based on the preselected option
updateVisibility();

// Add an event listener to the select element to update visibility upon change
inputTypeSelect.addEventListener('change', updateVisibility);




function crc16(data) {
  let crc = 0;
  let msb = crc >> 8;
  let lsb = crc & 0xFF;

  for(let i = 0; i < data.length; i++) {
    let c = data[i];
    let x = c ^ msb;
    x ^= (x >> 4);
    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  crc = (msb << 8) + lsb;
  return crc;
}

const fileErrorSizeMismatchElement = document.getElementById('data-error-size-mismatch');
const fileErrorInvalidChecksum = document.getElementById('data-error-invalid-checksum');

function checkFFSDSizeAndCRCPass(data) {
  // Hide all error messages initially
  document.querySelectorAll('[id^="data-error-"]').forEach(function(element) {
      element.style.display = 'none';
  });

  if(data.length !== 96) {
    // MUST BE 96 BYTES (FFLStoreData)
    //console.log('AAAAAAAA LENGTH IS NOT 96, IT IS ' + data.length)
    // Define the element ID based on the file size
    const errorElementId = 'data-error-size-' + data.length;

    // Check if a specific error message exists for the given file size
    const errorElement = document.getElementById(errorElementId);
    if(errorElement) {
        // If a specific error message exists, display it
        errorElement.style.display = '';
    } else {
        // If no specific message exists, show the general size mismatch message
        fileErrorSizeMismatchElement.style.display = '';
        fileErrorSizeMismatchElement.firstElementChild.textContent =
                            data.length; // Display the incorrect size
    }
  	return false;
  }

  // crc16 verify
  const dataCrc16 = data.slice(-2);
  // convert crc16 packed in mii data to uint16, then calculate expected
  const dataCrc16u16 = (dataCrc16[0] << 8) | dataCrc16[1];
  const expectedCrc16 = crc16(data.slice(0, -2));

  if(expectedCrc16 !== dataCrc16u16) {
  	// CHECKSUM FAILED
    //console.log('AAAAAA CHECKSUM FAILED')
    fileErrorInvalidChecksum.style.display = '';
    return false;
  }
  return true;
}


// wario land 3
function arianHandler() {
  // Get the path to complicated.html from a meta tag in the current document
  const metaComplicatedHtml = document.querySelector('meta[name=arianhandler-html-path]');
  if(!metaComplicatedHtml) {
    throw new Error('Meta tag for arianHandler HTML not found');
  }
  const complicatedHtmlPath = metaComplicatedHtml.content;

  fetch(complicatedHtmlPath)
    .then(response => {
      if(!response.ok) {
        // Throw an error with response status and statusText
        throw new Error(
          'HTTP Error: ' + response.status + ' ' + response.statusText
        );
      }
      return response.text();
    })
    .then(html => {
      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div);

      // Determine the ROM URL based on the current document's language
      const romMetaName = document.documentElement.lang.startsWith('es') ? 'rom-path-es' : 'rom-path';
      const romUrl = div.querySelector('meta[name=' + romMetaName + ']').content;

      // Start fetching the ROM and store the promise in a global variable
      window.romPromise = fetch(romUrl).then(response => response.arrayBuffer());

      // Load the scripts defined in complicated.html
      const scripts = div.getElementsByTagName('script');
      Array.from(scripts).forEach(script => {
        if(script.src) {
          const newScript = document.createElement('script');
          newScript.src = script.src;
          document.head.appendChild(newScript);
        }
      });
    });
}

const nnidInput = document.getElementById('nnid');
const randomButton = document.getElementById('random-nnid');
const nnidLoaded = document.getElementById('nnid-loaded');
const nnidLastModified = document.getElementById('nnid-last-modified');
let debounceTimeout;
const ACCEPT_OCTET_STREAM = false;

async function handleMiiDataFetch(apiUrl) {
    const headers = ACCEPT_OCTET_STREAM ? { 'Accept': 'application/octet-stream' } : {};
    return fetch(apiUrl, { headers })
        .then(response => {
            if(!response.ok) {
                return response.text().then(text => { throw new Error(text); });
            }
            if(ACCEPT_OCTET_STREAM && response.headers.get('Content-Type') === 'application/octet-stream') {
                return response.arrayBuffer().then(buffer => ({
                    data: new Uint8Array(buffer),
                    lastModified: response.headers.get('Last-Modified')
                }));
            }
            return response.json().then(data => ({
                ...data,
                lastModified: data.images && data.images.last_modified
            }));
        })
        .then(data => {
            nnidLoaded.style.display = 'none';
            nnidLastModified.style.display = 'none';

            let decodedData;
            if(data.data instanceof Uint8Array) {
                decodedData = data.data;
            } else {
                if(!data.data) {
                    throw new Error('No data attribute in response');
                }
                decodedData = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
                if(data.user_id) {
                    nnidInput.value = data.user_id;
                }
            }

            if(checkFFSDSizeAndCRCPass(decodedData)) {
                nnidInput.setCustomValidity('');

                // Extract and show Mii name
                nnidLoaded.style.display = '';
                nnidLoaded.firstElementChild.textContent = extractMiiNameFromFFSD(decodedData);

                // Show last modified date if available
                if(data.lastModified) {
                    nnidLastModified.style.display = '';
                    nnidLastModified.firstElementChild.textContent = new Date(data.lastModified).toLocaleString();
                }
            } else {
                const errorText = document.querySelector('[id^="data-error-"]:not([style*="none"])').textContent;
                nnidInput.setCustomValidity(errorText || 'Invalid data');
            }
        });
}

nnidInput.addEventListener('input', function () {
    clearTimeout(debounceTimeout);

    debounceTimeout = setTimeout(function () {
        const nnidValue = nnidInput.value.trim();
        const apiUrl = nnidInput.getAttribute('data-action') + nnidValue;

        if(nnidValue.length > 0) {
            handleMiiDataFetch(apiUrl)
                .catch(error => {
                    nnidInput.setCustomValidity(error.message);
                    nnidInput.reportValidity();
                })
                .finally(() => {
                    if(!formSubmitting) {
                        nnidInput.disabled = false;
                        submitButton.disabled = false;
                        randomButton.disabled = false;
                    }
                });
        } else {
            nnidInput.setCustomValidity('');
            nnidInput.reportValidity();
        }
    }, 500); // 500ms debounce
});

randomButton.addEventListener('click', function () {
    const apiUrl = randomButton.getAttribute('data-action');
    nnidInput.disabled = true;
    submitButton.disabled = true;
    randomButton.disabled = true;

    handleMiiDataFetch(apiUrl)
        .catch(error => {
            // Create and append the error message
            const errorLiOriginal = document.getElementsByClassName('load-error');
            const errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
            errorLi.style.display = '';
            errorLi.textContent = error.message;
            resultList.insertBefore(errorLi, resultList.firstChild);
        })
        .finally(() => {
            if(!formSubmitting) {
                nnidInput.disabled = false;
                submitButton.disabled = false;
                randomButton.disabled = false;
            }
        });
});
