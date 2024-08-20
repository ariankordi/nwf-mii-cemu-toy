// handle unhandled promise rejections as well as errors
window.addEventListener('unhandledrejection', function(event) {
  var errorContainer = document.getElementById('error-container');
  var errorMessage = document.getElementById('error-message');
  var errorStacktrace = document.getElementById('error-stacktrace');
  var errorAt = document.getElementById('error-at');
  errorMessage.textContent = event.reason.message || 'Unhandled Promise Rejection';

  // show stack trace if it has one
  if(event.reason && event.reason.stack) {
    errorStacktrace.textContent = event.reason.stack;
    errorStacktrace.style.display = '';
  } else {
    // if no stack trace, hide the stack trace section
    errorStacktrace.style.display = 'none';
  }

  // hide the line number section since it's not applicable
  errorAt.style.display = 'none';
  // un-hide the error container
  errorContainer.style.display = '';
});

// Select elements based on their names and ids
const resolutionNumber = document.getElementsByName('width')[0];
const widthSlider = document.getElementById('resolution-slider');
const bgColor = document.getElementsByName('bgColor')[0];
const transparentCheckbox = document.getElementById('transparent-checkbox');

const bgDefault = '#ffffff'//bgColor.value;

function synchronizeInputs(input1, input2) {
  input1.addEventListener('input', function() {
    input2.value = this.value;
  });

  input2.addEventListener('input', function() {
    input1.value = this.value;
  });
}

// Call the synchronize function for each pair of elements
synchronizeInputs(resolutionNumber, widthSlider);
synchronizeInputs(document.getElementById('cameraXRotate'), document.getElementById('cameraXRotate-slider'));
synchronizeInputs(document.getElementById('cameraYRotate'), document.getElementById('cameraYRotate-slider'));
synchronizeInputs(document.getElementById('cameraZRotate'), document.getElementById('cameraZRotate-slider'));

// When the transparent-checkbox is checked, change the background color to #00ff00
transparentCheckbox.addEventListener('change', function() {
  if(this.checked) {
    bgColor.value = bgDefault;
    //this.disabled = true;
  }/* else if(bgColor.value === bgDefault) {
    // TODO: you may consider changing bg by one
    // so you can still have a green background
    this.checked = true;
    this.disabled = true;
  }*/
});

const texResolutionEnable = document.getElementById('texResolutionEnable');
const texResolution = document.getElementById('texResolution');
texResolutionEnable.addEventListener('change', function() {
  texResolution.disabled = !this.checked;
});

// When the background color is changed to #00ff00, check the transparent-checkbox
// Note: This also unchecks the checkbox if the color is changed to anything other than #00ff00

bgColor.addEventListener('input', function() {
  transparentCheckbox.checked = false;
  /*if(this.value.toLowerCase() === bgDefault) {
    transparentCheckbox.checked = true;
    transparentCheckbox.disabled = true;
  } else {
    transparentCheckbox.checked = false;
    transparentCheckbox.disabled = false;
  }*/
});


const scaleInput = document.getElementsByName('scale')[0];
const realMax = 1200;
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
let sessionID;
// Set a unique request ID each time a request is sent
const sessReqIDInput = document.getElementById('errorSessionAndRequestID');

// NOTE: maximum length is 12
const randomString = length => Math.random().toString(36).substring(2, length + 2);

sessionID = 's' + randomString(4); // Generate a random session ID once

const errorResponses = new Map(); // Temporarily store error messages

let evtSource = null;
// Function to ensure the SSE connection is established
function connectErrorReportingSSE() {
  // Only attempt to connect if not already connected or in an attempt to reconnect
  if(!evtSource || evtSource.readyState === EventSource.CLOSED) {
    evtSource = new EventSource('/error_reporting?errorSessionID='
                                + sessionID);

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

const resultTemplate = document.getElementById('result-template');

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
  // combine the two IDs together separating with a dash
  const requestID = 'r' + randomString(2);
  sessReqIDInput.value = sessionID + '-' + requestID;

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
  const searchParams = new URLSearchParams([...formData.entries()]);
  if(transparentCheckbox.checked)
    searchParams.delete('bgColor');
  const data = formData.get('data')
  console.log('DATA INPUT:', data);
  const params = searchParams.toString();
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
    img.onerror = function() {
      // Handle image loading error
      const errorLiOriginal = document.getElementsByClassName('load-error');
      // get last error li, the original
      const errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
      // Generic error message unless overwritten by SSE message
      errorLi.setAttribute('data-error-request-id', requestID);
      const errorResponse = errorResponses.get(requestID);
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
      /*const li = document.createElement('li');
      li.appendChild(img); // Append the <img> to the <li>
      */

      // clone the template so that we can put the result text in it
      const resultTemplateClone = resultTemplate.cloneNode(true);
      // remove the id so that it does not conflict
      resultTemplateClone.removeAttribute('id');
      // this SHOULD be the first span in summary
      // NOTE: this line is most likely to error out
      /*const nameInResult = resultTemplateClone.getElementsByTagName('summary')[0].firstElementChild;
      nameInResult.textContent = name;
      */
      // define data as data-data attribute in details
      const detailsInResult = resultTemplateClone.getElementsByTagName('details')[0];
      if(data) {
        // only if it isn't falsey of course
        detailsInResult.setAttribute('data-data', data);
        fillNameInDetailsFromDataString(resultTemplateClone, data);
      } else {
        console.warn('why is data falsey here????');
        // hide it for now
        // TODO TODO TODO TODO NNID DATA
        detailsInResult.style.display = 'none';
      }
      const resultImageContainer = resultTemplateClone.getElementsByClassName('image-template')[0];
      resultImageContainer.appendChild(img); // Append the <img> to the <li>

      // finally, reveal and prepend it
      resultTemplateClone.style.display = '';

      resultList.insertBefore(resultTemplateClone, resultList.firstChild);

      // remove on successful load
      const tutorial = document.getElementById('tutorial');
      if(tutorial) tutorial.parentElement.removeChild(tutorial);
    };
  }
});

const supportedTypes = [
  // don't think anyone actually uses this
  {
    name: 'FFLiMiiDataCore',
    sizes: [72],
    offsetName: 0x1A,
  },
  { // "3dsmii"
    name: 'FFLiMiiDataOfficial',
    sizes: [92],
    offsetName: 0x1A,
  },
  {
    name: 'FFLStoreData',
    sizes: [96],
    offsetCRC16: 94,
    offsetName: 0x1A,
  },
  {
    name: 'RFLCharData',
    sizes: [74],
    offsetName: 0x2,
    isNameU16BE: true
  },
  {
    name: 'RFLStoreData',
    sizes: [76],
    offsetCRC16: 74,
    offsetName: 0x2,
    isNameU16BE: true
  },
  {
    name: 'nn::mii::CharInfo',
    sizes: [88],
    offsetName: 0x10,
  },
  {
    name: 'nn::mii::CoreData',
    sizes: [48, 68],
    offsetName: 0x1C,
  },
  // TODO: DON'T KNOW THE CRC, DON'T HAVE SAMPLES EITHER
  /*{
    name: 'nn::mii::StoreData',
    sizes: [68],
    offsetName: 0x1C,
  },*/
  /*
        <!-- switch mii store data types:
        nn::mii::CoreData - 48 bytes
          * size from method nn::mii::detail::CoreDataRaw::SetDefault
            - contains memset for 0x30 = size is 0x30/48
        nn::mii::StoreData - 68 bytes, i think
          * size from method nn::mii::detail::StoreDataRaw::UpdateDeviceCrc -> nn::mii::detail::CalculateAndSetCrc16
            - sets total size to 0x44 = size is 0x44/68
        -->
  */
  {
    name: 'Mii Studio Data',
    sizes: [46, 47], // ignoring the encoded format for now
  },
];

const findSupportedTypeBySize = size => supportedTypes.find(type => type.sizes.includes(size));

let globalVerifyCRC16 = true;

const verifyCRC16Checkbox = document.getElementById('verifyCRC16');
verifyCRC16Checkbox.addEventListener('change', function() {
  globalVerifyCRC16 = !this.checked;
});

/*
function extractNameFromSupportedType(data, type) {
  if(!type) {
    // No supported type found for the given data size
    return null;
  }

  if(!type.offsetName) {
    return type.name; // Return the type name if no offset is provided
  }

  // Extract UTF-16 LE Mii name starting at the specified offset
  const startOffset = type.offsetName;
  const nameLength = 0x14;
  let endPosition = startOffset;
  // Find the position of the null terminator (0x00 0x00)
  while(endPosition < startOffset + nameLength) {
    if(data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16 LE)
  }

  const textFormat = type.nameFormat === undefined ? 'utf-16le' : type.nameFormat;

  // NOTE: TextDecoder only works on newish browsers
  // despite the rest of this script using pre-ES6 syntax
  // TODO: TEST ON OLDER BROWSERS!!!!!!!!!!
  const nameBytes = data.slice(startOffset, endPosition);
  const nameString = new TextDecoder(textFormat).decode(nameBytes);
  return nameString;
}
*/

const crc16ChecksumFailedText = document.getElementById('crc16-checksum-failed-text');

function extractUTF16Text(data, startOffset, isBigEndian, nameLength) {
  // Default to 10 characters (20 bytes) if nameLength is not provided
  const length = nameLength !== undefined ? nameLength * 2 : 20;
  let endPosition = startOffset;

  // Determine the byte order based on the isBigEndian flag
  // NOTE: TextDecoder only works on newish browsers
  // despite the rest of this script using pre-ES6 syntax
  // TODO: TEST ON OLDER BROWSERS!!!!!!!!!!
  const decoder = new TextDecoder(isBigEndian ? 'utf-16be' : 'utf-16le');

  // Find the position of the null terminator (0x00 0x00)
  while (endPosition < startOffset + length) {
    if (data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16)
  }

  // Extract and decode the name bytes
  const nameBytes = data.slice(startOffset, endPosition);
  return decoder.decode(nameBytes);
}

function getNameFromSupportedType(data, type) {
  if (!type)
    return false;

  if (!type.offsetName)
    return null;
    // specifically return null for no offset name
    // so that the next function uses the type name instead

  // Use the new extractUTF16Text function to get the name string
  const nameString = extractUTF16Text(data, type.offsetName, type.isNameU16BE, type.nameLength);

  return nameString;
}

function displayNameFromSupportedType(data, nameElement, type, crc16NotPassed) {
  if(!type)
    return false;

  const nameString = getNameFromSupportedType(data, type);

  // Handle the case where there's no offsetName
  nameElement.firstElementChild.textContent =
    // use the type name if the name is null (type has no name offset)
    nameString !== null ? nameString : type.name;

  nameElement.style.display = '';
  if(crc16NotPassed) {
    nameElement.style.color = 'red';
    nameElement.firstElementChild.textContent += crc16ChecksumFailedText.textContent;
  }
  else if(type.offsetCRC16)
    nameElement.style.color = 'green';
  else
    // color that means no crc16 supported
    nameElement.style.color = 'olivedrab'
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
    const data = base64ToUint8Array(base64Data);

    const type = findSupportedTypeBySize(data.length);

    // this function will handle errors, showing and returning false
    // if there are no errors it should pass tho
    const checkResult = checkSupportedTypeBySize(data, type, globalVerifyCRC16);
    if(!checkResult) {
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
    //if(data.length != 96) return;
    // extract name and show loaded text
    displayNameFromSupportedType(data, fileLoaded, type, (checkResult === 2));
  };
  reader.readAsDataURL(fileInput.files[0]);
  return;
});

const dataLoaded = document.getElementById('data-loaded');
const dataInput = document.getElementById('data');

const stripSpaces = str => str.replace(/\s+/g, '');
const hexToUint8Array = hex => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
const base64ToUint8Array = base64 => {
  // Replace URL-safe Base64 characters
  const normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if necessary
  const paddedBase64 = normalizedBase64.padEnd(normalizedBase64.length + (4 - (normalizedBase64.length % 4)) % 4, '=');
  return Uint8Array.from(atob(paddedBase64), c => c.charCodeAt(0));
};
const uint8ArrayToBase64 = data => btoa(String.fromCharCode.apply(null, data));

const parseHexOrB64TextStringToUint8Array = text => {
  let inputData;
  // decode it to a uint8array whether it's hex or base64
  const textData = stripSpaces(text);
  // check if it's base 16 exclusively, otherwise assume base64
  if (/^[0-9a-fA-F]+$/.test(textData))
    inputData = hexToUint8Array(textData);
  else
    inputData = base64ToUint8Array(textData);

  return inputData;
};

// same but for base64 mii data
dataInput.addEventListener('input', function() {
  // remove mii name
  dataLoaded.style.display = 'none';
  dataInput.setCustomValidity('');
  // ignore if is not base64
  if(dataInput.validity.patternMismatch) {
    return;
  }

  // if a url that resembles a studio url with data
  // is passed in then literally parse it and remove the rest
  try {
    if(dataInput.value.includes('data=')) {
      const url = new URL(dataInput.value);
      const dataParam = url.searchParams.get('data');
      if(dataParam
        // NOTE: make sure it is as long
        // as studio url data, encoded (only.)
        && dataParam.length === 94
      )
        // set the input value to that directly, removing everything else
        dataInput.value = dataParam;
    }
  } catch(error) {
      console.warn('error while trying to strip what we thought was a studio url bc it had "data=" in it:', error);
  }


  // TODO TRY AND CATCH THIS BLOCK
  // decode so we can verify it and read the mii name
  let data;
  try {
    data = parseHexOrB64TextStringToUint8Array(dataInput.value);
  } catch(error) {
    dataInput.setCustomValidity('We tried to decode as hex and Base64 and failed at both: ' + error);
    return;
  }

  const type = findSupportedTypeBySize(data.length);

  // this function will handle errors, showing and returning false
  // if there are no errors it should pass tho
  const checkResult = checkSupportedTypeBySize(data, type, globalVerifyCRC16);
  if(!checkResult) {
    // remove file to invalidate the form
    const errorText = document.querySelector(errorTextQuery).textContent;
    if(errorText) dataInput.setCustomValidity(errorText);
    // do not mark success
    return;
  }
  // assuming success
  // extract name and show loaded text
  displayNameFromSupportedType(data, dataLoaded, type, (checkResult === 2));
  return;
});

// Active input management
let activeInput = null;

// hide all file statuses/errors whenever you switch input types
function hideAllErrors() {
  document.querySelectorAll('[id^="data-error-"]').forEach(function(element) {
      element.style.display = 'none';
  });
}

// Helper function to set active input
function setActiveInput(input) {
  activeInput = input;
  // Update classes and names for all inputs in the data group
  document.querySelectorAll('#data-group input').forEach(inp => {
    // if this input isn't the active input...
    if(inp !== activeInput
      // and
      &&
      // active input is not file AND this input is not file-data
      !(activeInput.id === 'file' && inp.id === 'file-data')) {
      // disable this input!
      inp.classList.remove('green-border');
      if(inp.name) {
        inp.setAttribute('data-name-disabled', inp.name);
        inp.removeAttribute('name');
        inp.setCustomValidity('');
      }
    } else {
      inp.classList.add('green-border');
      if(inp.getAttribute('data-name-disabled')) {
        inp.setAttribute('name', inp.getAttribute('data-name-disabled'));
        inp.removeAttribute('data-name-disabled');
      }
    }
  });

  // if you didn't just upload a file just now...
  // and if the file has a file input but not data...
  // un-upload a file bc that means there was an error
  if (activeInput !== fileInput && !fileDataInput.value && fileInput.value)
    fileInput.value = '';

  //hideAllErrors();
}

function fillNameInDetailsFromDataString(parent, dataString) {
  const firstSummaryInParent = parent.getElementsByTagName('summary')[0];
  const nameFieldElement = firstSummaryInParent.firstElementChild;
  // assuming the top are defined   all well and good and yes.

  const data = parseHexOrB64TextStringToUint8Array(dataString);
  const type = findSupportedTypeBySize(data.length);
  // asssuuumiiinggg it will always be supported
  const nameString = getNameFromSupportedType(data, type);

  nameFieldElement.textContent =
    nameString !== null ? nameString : type.name;

  // if name string is falsey (null) then STOP HERE!
  // bc it will set it to a string "null"
  if(!nameString) return;
  // set data-name to be objective name which can be blank
  const firstDetailsInParent = parent.getElementsByTagName('details')[0];
  firstDetailsInParent.setAttribute('data-name', nameString);
}

// Event listener for file input
fileInput.addEventListener('input', function() {
  if(fileInput.files.length > 0)
    setActiveInput(fileInput);
});

// Event listener for data input
dataInput.addEventListener('input', function() {
  if(dataInput.value.trim() !== '')
    setActiveInput(dataInput);
});

// Event listeners for labels
document.querySelector('label[for="file"]').addEventListener('click', function() {
  if(fileInput.files.length > 0)
    setActiveInput(fileInput);
});

document.querySelector('label[for="data"]').addEventListener('click', function() {
  if(dataInput.value.trim() !== '')
    setActiveInput(dataInput);
});




const inputTypeSelect = document.getElementById('input_type');

function updateVisibility() {
  hideAllErrors();

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

// connect the error reporting sse channel when you first open the page
connectErrorReportingSSE();


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

/*
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
*/

function checkSupportedTypeBySize(data, type, checkCRC16) {
  hideAllErrors();

  const fileErrorSizeMismatchElement = document.getElementById('data-error-size-mismatch');
  const fileErrorInvalidChecksum = document.getElementById('data-error-invalid-checksum');

  if (!type) {
    const errorElementId = 'data-error-size-' + data.length;
    const errorElement = document.getElementById(errorElementId);
    if (errorElement) {
      errorElement.style.display = '';
    } else {
      fileErrorSizeMismatchElement.style.display = '';
      fileErrorSizeMismatchElement.firstElementChild.textContent = data.length;
    }
    return false;
  }

  if (type.offsetCRC16) {
    const dataCrc16 = data.slice(type.offsetCRC16, type.offsetCRC16 + 2);
    const dataCrc16u16 = (dataCrc16[0] << 8) | dataCrc16[1];
    const expectedCrc16 = crc16(data.slice(0, type.offsetCRC16));

    if (expectedCrc16 !== dataCrc16u16) {
      if(checkCRC16) {
        fileErrorInvalidChecksum.style.display = '';
        return false;
      }
      else
        // returns a third type
        return 2;
    }
  }

  return true;
}

const shaderType = document.getElementById('shaderType');
const shaderType2Inaccurate = document.getElementById('shader-type-2-inaccurate');

shaderType.addEventListener('change', function() {
  if(shaderType.value === '2')
    shaderType2Inaccurate.style.display = '';
  else
    shaderType2Inaccurate.style.display = 'none';
});

const viewType = document.getElementById('type');
const viewTypeAllBodyInaccurate = document.getElementById('view-type-all-body-inaccurate');

viewType.addEventListener('change', function() {
  if(viewType.value === 'all_body')
    viewTypeAllBodyInaccurate.style.display = '';
  else
    viewTypeAllBodyInaccurate.style.display = 'none';
});

// wario land 3
function arianHandler() {
  // Get the path to complicated.html from a meta tag in the current document
  const metaComplicatedHtml = document.querySelector('meta[itemprop=arianhandler-html-path]');
  if(!metaComplicatedHtml || !metaComplicatedHtml.content) {
    throw new Error('arianHandler HTML tag not found so we cannot initiate Wario Land 3 :(');
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
    .then(async response => {
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
        decodedData = base64ToUint8Array(data.data);
        if(data.user_id) {
          nnidInput.value = data.user_id;
        }
      }

      const type = findSupportedTypeBySize(decodedData.length);

      const checkResult = checkSupportedTypeBySize(decodedData, type, globalVerifyCRC16);
      if(checkResult) {
        nnidInput.setCustomValidity('');

        // Extract and show Mii name
        displayNameFromSupportedType(decodedData, nnidLoaded, type, (checkResult === 2));

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
        nnidInput.focus();
      }
    });
});
