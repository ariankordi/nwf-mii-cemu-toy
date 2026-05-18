/**
 * @file Primary script that handles website form functionality.
 * Only directly calls into data-conversion.js in {@link setDataConvertInline} and iframe handler.
 * Sets up event listeners and error handler for the site.
 * The other modules are intended to be loaded asynchronously and not used immediately.
 * @author Arian Kordi <ariankordi@ariankordi.net>
 */

// @ts-check
import {
  convertDataToType, studioFormat, studioURLEncodeHex, bytesToHex
} from './data-conversion.js';
import { bindResultTemplateHandlers } from './convert-dropdown.js';
import {
  crc16, parseHexOrB64ToBytes,
  bytesToBase64, base64ToBytes,
  extractUTF16Text, findSupportedTypeBySize
} from './common.js';

// handle unhandled promise rejections as well as errors
window.addEventListener('unhandledrejection', function (event) {
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const errorStacktrace = document.getElementById('error-stacktrace');
  const errorAt = document.getElementById('error-at');
  errorMessage.textContent = event.reason && event.reason.message
    ? event.reason.message
    : 'Unhandled Promise Rejection';

  // show stack trace if it has one
  if (event.reason && event.reason.stack) {
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

/** bgColor.value; */
const bgDefault = '#ffffff';

/**
 *
 * @param {HTMLInputElement} input1
 * @param {HTMLInputElement} input2
 */
function synchronizeInputs(input1, input2) {
  input1.addEventListener('input', function () {
    input2.value = this.value;
  });

  input2.addEventListener('input', function () {
    input1.value = this.value;
  });
}

// Call the synchronize function for each pair of elements
synchronizeInputs(resolutionNumber, widthSlider);
synchronizeInputs(document.getElementById('cameraXRotate'), document.getElementById('cameraXRotate-slider'));
synchronizeInputs(document.getElementById('cameraYRotate'), document.getElementById('cameraYRotate-slider'));
synchronizeInputs(document.getElementById('cameraZRotate'), document.getElementById('cameraZRotate-slider'));

synchronizeInputs(document.getElementById('characterXRotate'), document.getElementById('characterXRotate-slider'));
synchronizeInputs(document.getElementById('characterYRotate'), document.getElementById('characterYRotate-slider'));
synchronizeInputs(document.getElementById('characterZRotate'), document.getElementById('characterZRotate-slider'));

// When the transparent-checkbox is checked, change the background color to #00ff00
transparentCheckbox.addEventListener('change', function () {
  if (this.checked) {
    bgColor.value = bgDefault;
    // this.disabled = true;
  }/* else if(bgColor.value === bgDefault) {
    // TODO: you may consider changing bg by one
    // so you can still have a green background
    this.checked = true;
    this.disabled = true;
  } */
});

const texResolutionEnable = document.getElementById('texResolutionEnable');
const texResolution = document.getElementById('texResolution');
texResolutionEnable.addEventListener('change', function () {
  texResolution.disabled = !this.checked;
});

// When the background color is changed to #00ff00, check the transparent-checkbox
// Note: This also unchecks the checkbox if the color is changed to anything other than #00ff00

bgColor.addEventListener('input', function () {
  transparentCheckbox.checked = false;
  /* if(this.value.toLowerCase() === bgDefault) {
    transparentCheckbox.checked = true;
    transparentCheckbox.disabled = true;
  } else {
    transparentCheckbox.checked = false;
    transparentCheckbox.disabled = false;
  } */
});

const scaleInput = document.getElementsByName('scale')[0];
const realMax = 1200;

/** Function to update max resolution based on scale */
function updateMaxResolution() {
  const scale = Number.parseInt(scaleInput.value, 10);
  const maxResolution = realMax / scale;

  // Adjust current values if they exceed the new max
  if (widthSlider.value > maxResolution) {
    widthSlider.value = maxResolution;
    // debugger;
    resolutionNumber.value = maxResolution;
  }

  widthSlider.max = maxResolution;
  resolutionNumber.max = maxResolution;
}

/** Set a unique request ID each time a request is sent */
const sessReqIDInput = document.getElementById('errorSessionAndRequestID');

/**
 * NOTE: maximum length is 12
 * @param {number} length
 * @returns {string}
 */
const randomString = length => Math.random().toString(36).substring(2, length + 2);

/** Session ID is set once from a random string and used for the lifespan of the page */
const sessionID = 's' + randomString(4);

/** Temporarily store error messages */
const errorResponses = new Map();

let evtSource = null;
/** Function to ensure the SSE connection is established */
function connectErrorReportingSSE() {
  // Only attempt to connect if not already connected or in an attempt to reconnect
  if (!evtSource || evtSource.readyState === EventSource.CLOSED) {
    evtSource = new EventSource('/error_reporting?errorSessionID=' +
      sessionID);

    evtSource.onmessage = function (event) {
      // Handle incoming error messages by updating the DOM or storing them temporarily
      const error = JSON.parse(event.data);
      // console.log(error)
      const listItem = document.querySelector('[data-error-request-id="' + error.requestID + '"]');
      if (listItem) {
        listItem.textContent = error.message;
        const listImg = listItem.querySelector('img');
        if (listImg) {
          listImg.remove();
        }
      } else {
        errorResponses.set(error.requestID, error.message);
      }
      if (errorResponses.size > 10) {
        // Ensure we don't exceed 10 stored messages
        const firstKey = errorResponses.keys().next().value;
        errorResponses.delete(firstKey);
      }
    };

    evtSource.onerror = function () {
      console.error('EventSource failed. No further attempts to reconnect will be made unless a request is sent.');
      evtSource.close();
    };
  }
}

// Listen for changes in the scale input to update max resolution
scaleInput.addEventListener('input', updateMaxResolution);

// Initial setup - apply the correct maximums based on the initial scale value
updateMaxResolution();

/** save specific fields marked with data-save, to localStorage upon submit */
function saveSpecifiedFieldsToLocalStorage() {
  // go through every input that is to be saved
  // and those will have the data-save attribute
  // if they are not disabled, put their value in localstorage
  for (const element of document.querySelectorAll('[data-save]')) {
    // do not save if it is disabled (not active group)
    if (element.disabled) {
      continue;
    }
    let inputValue = element.value;
    // if this is a checkbox, then the value is if it is checked
    if (element.type === 'checkbox') {
      inputValue = element.checked;
    } else if (element.nodeName === 'DETAILS') {
      inputValue = element.open;
    }
    let inputName = element.name;
    if (!inputName) {
      // use id as name
      inputName = element.id;
    }
    // if it's still null then ERROR!!! out
    if (!inputName) {
      console.error('this element doesn\'t have name or id:', element);
      continue;
    }
    // if it is default, check if it is there and remove it
    if (element.dataset.defaultValue == inputValue) {
      localStorage.removeItem('form-value-' + inputName);
      continue;
    }
    const encodedValue = JSON.stringify(inputValue);

    localStorage.setItem('form-value-' + inputName, encodedValue);
  }
}

/** Loads fields from local storage that have HTML elements with data-save property attached. */
function loadSpecifiedFieldsFromLocalStorage() {
  // go through every input that has the data-save attribute
  for (const element of document.querySelectorAll('[data-save]')) {
    let inputName = element.name;
    if (!inputName) {
      // use id as name if the name is not available
      inputName = element.id;
    }

    // if it's still null, log an error and skip this element
    if (!inputName) {
      console.error('this element doesn\'t have a name or id:', element);
      continue;
    }
    const savedValue = localStorage.getItem('form-value-' + inputName);
    // If there is no saved value, skip this element
    if (!savedValue) {
      continue;
    }
    // Parse the saved value from JSON
    const decodedValue = JSON.parse(savedValue);
    // Set the value or checked status based on the element type
    if (element.type === 'checkbox') {
      element.checked = decodedValue;
    } else if (element.nodeName === 'DETAILS') {
      element.open = decodedValue;
    } else {
      element.value = decodedValue;
    }
    // Fire the change event after setting the value
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    if (element.type === 'details') {
      element.dispatchEvent(new Event('toggle', { bubbles: true }));
    }
  }
}

const shaderType = document.getElementById('shaderType');

// iframe mode - do not submit to server but submit to outer frame
const iframeMode = Object.prototype.hasOwnProperty.call(document.body.dataset, 'iframeMode');
// assumes there is only ONE form on the page or at least the one we want is the first one
const form = document.forms[0];
const resultList = document.getElementById('results');

const resultTemplate = document.getElementById('result-template');

const submitButton = document.getElementById('submit');

let formSubmitting = false;

const ACTIVATE_ARIAN_HANDLER = location.host === 'mii-unsecure.ariankordi.net';
/** AKnet_1.0 */
const ACTIVATE_ARIAN_HANDLER_NNID = 'aknet10';

/** @param {SubmitEvent} event */
function onFormSubmit(event) {
  event.preventDefault(); // Prevent the default form submission via HTTP
  formSubmitting = true;
  submitButton.disabled = true; // Disable the button
  submitButton.setAttribute('value', submitButton.dataset.value);

  let arianHandlerResult = false;
  if (ACTIVATE_ARIAN_HANDLER &&
    nnid.value.replace(/[_\-.]/g, '').toLowerCase() ===
    ACTIVATE_ARIAN_HANDLER_NNID &&
    arianHandler !== undefined) {
    try {
      arianHandlerResult = arianHandler();
    } catch (error) {
      /*
      const errorDiv = document.createElement('div');
      errorDiv.textContent = error.message;
      errorDiv.style.color = 'red'; // Set text color to red
      document.body.insertBefore(errorDiv, document.body.firstChild); // Insert at the beginning of the body
      submitButton.disabled = false; // Re-enable the button
      submitButton.removeAttribute('value');
      */
      const errorLi = getErrorLi();
      errorLi.textContent = error.message;
      errorLi.style.display = '';

      formSubmitting = false;
      submitButton.disabled = false; // Re-enable the button
      submitButton.removeAttribute('value');

      resultList.insertBefore(errorLi, resultList.firstChild); // Insert at the top
    } finally {
      if (arianHandlerResult) {
        return;
      }
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
  if (transparentCheckbox.checked) {
    searchParams.delete('bgColor');
  }

  // handle light disable as a special case
  // this was in response to switch shader
  // with disable lighting option being unreliable
  // so let's just make it separate altogether
  if (shaderType.value === 'light_disable') {
    searchParams.delete('shaderType');
    searchParams.append('lightEnable', '0');
  }

  // iterate through elements with data-default-value attribute
  // for each of these inputs, if the value matches the default...
  // then they will be excluded from the search params to clean it up
  for (const element of document.querySelectorAll('[data-default-value]')) {
    const defaultValue = element.dataset.defaultValue;

    let inputValue = element.value;
    // if this is a checkbox, then the value is if it is checked
    if (element.type === 'checkbox') {
      inputValue = element.checked;
    }

    // double equals means that '0' will match 'disabled' (checkbox)
    if (inputValue == defaultValue) {
      searchParams.delete(element.name);
    }
  }

  // allow fields to override others if their value is not default
  for (const overridingElement of document.querySelectorAll('[data-override]')) {
    const overrideTargetName = overridingElement.dataset.override;
    const overrideValue = overridingElement.value;
    const overrideDefaultValue = overridingElement.dataset.defaultValue || '';

    if (overrideValue !== overrideDefaultValue) {
      // Set the override value, replacing any existing value for the target field
      searchParams.set(overrideTargetName, overrideValue);
    }
  }

  // data-REAL overrides the data for conversion
  const dataForConversion = formData.get('data-REAL');
  if (dataForConversion !== undefined) {
    // delete it so it is not sent to the server, only used for js
    searchParams.delete('data-REAL');
  }
  const data = dataForConversion ? dataForConversion : formData.get('data');
  console.log('data input:', data);
  const params = searchParams.toString();
  // more compatible? version taken from: https://stackoverflow.com/a/43000398
  // expand the elements from the .entries() iterator into an actual array
  /* const paramsParts = [...formData.entries()]
                     // transform the elements into encoded key-value-pairs
                     .map(e => encodeURIComponent(e[0]) + "=" + encodeURIComponent(e[1]));
  const params = paramsParts.join('&');
  */
  createAndAppendImage(params);

  /** @param {string} params */
  function createAndAppendImage(params) {
    // request image from form action
    const imageBase = form.action;

    const imageUrl = imageBase + '?' + params;

    // Create and append the <img> element
    const img = document.createElement('img');
    img.src = imageUrl;
    img.onerror = function () {
      const errorLi = getErrorLi();
      // Generic error message unless overwritten by SSE message
      errorLi.dataset.errorRequestId = requestID;
      const errorResponse = errorResponses.get(requestID);
      if (errorResponse !== undefined) {
        errorLi.textContent = errorResponse;
      }

      errorLi.style.display = '';

      formSubmitting = false;
      submitButton.disabled = false; // Re-enable the button
      submitButton.removeAttribute('value');

      if (errorResponse === undefined) {
        errorLi.append(img);
      } // Append the <img> inside of the the error li
      resultList.insertBefore(errorLi, resultList.firstChild); // Insert at the top
    };
    img.addEventListener('load', function () {
      // Re-enable the button upon successful image load
      formSubmitting = false;
      submitButton.disabled = false;
      submitButton.removeAttribute('value');

      img.className += ' fade-in'; // Add the fade-in class
      // Insert the new <li> at the top of the list
      /* const li = document.createElement('li');
      li.appendChild(img); // Append the <img> to the <li>
      */

      // clone the template so that we can put the result text in it
      const resultTemplateClone = resultTemplate.cloneNode(true);
      // remove the id so that it does not conflict
      resultTemplateClone.removeAttribute('id');
      // this SHOULD be the first span in summary
      // NOTE: this line is most likely to error out
      /* const nameInResult = resultTemplateClone.getElementsByTagName('summary')[0].firstElementChild;
      nameInResult.textContent = name;
      */
      // define data as data-data attribute in details
      const detailsInResult = resultTemplateClone.getElementsByTagName('details')[0];
      if (data) {
        // only if it isn't falsey of course
        detailsInResult.dataset.data = data;
        fillNameInDetailsFromDataString(resultTemplateClone, data);
      } else {
        console.warn('why is data falsey here????');
        // hide it for now
        // TODO TODO TODO TODO NNID DATA
        detailsInResult.style.display = 'none';
      }
      const resultImageContainer = resultTemplateClone.getElementsByClassName('image-template')[0];
      resultImageContainer.append(img); // Append the <img> to the <li>

      // finally, reveal and prepend it
      resultTemplateClone.style.display = '';

      resultList.insertBefore(resultTemplateClone, resultList.firstChild);
      bindResultTemplateHandlers(resultTemplateClone, handleCopyButtonAndUpdateText);

      // remove on successful load
      const tutorial = document.getElementById('tutorial');
      if (tutorial) {
        tutorial.remove();
      }

      // save fields for saving, only after image successfully loaded
      saveSpecifiedFieldsToLocalStorage();
    });
  }
}

if (iframeMode) {
  // special form handler for iframe mode
  form.addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent the default form submission via HTTP
    formSubmitting = true;
    submitButton.disabled = true; // Disable the button

    const formData = new FormData(form);
    const searchParams = new URLSearchParams([...formData.entries()]);
    if (transparentCheckbox.checked) {
      searchParams.delete('bgColor');
    }
    searchParams.delete('erri');

    const dataForConversion = formData.get('data-REAL');
    if (dataForConversion) {
      // delete it so it is not sent to the server, only used for js
      searchParams.delete('data-REAL');
    }
    const data = dataForConversion ? dataForConversion : formData.get('data');
    console.log('data input:', data);

    if (data) { // not empty, null, or undefined
      const inputData = parseHexOrB64ToBytes(data);

      // run the function to convert the data from the image to raw studio data
      const studioData = convertDataToType(inputData, studioFormat);
      const studioURLData = studioURLEncodeHex(studioData);
      searchParams.append('studioData', studioURLData);
    }

    // iterate through elements with data-default-value attribute
    // for each of these inputs, if the value matches the default...
    // then they will be excluded from the search params to clean it up
    for (const element of document.querySelectorAll('[data-default-value]')) {
      const defaultValue = element.dataset.defaultValue;

      let inputValue = element.value;
      // if this is a checkbox, then the value is if it is checked
      if (element.type === 'checkbox') {
        inputValue = element.checked;
      }

      // double equals means that '0' will match 'disabled' (checkbox)
      if (inputValue == defaultValue) {
        searchParams.delete(element.name);
      }
    }

    const params = Object.fromEntries(searchParams);
    // post to above iframe
    window.top.postMessage(params, '*');
  });
  window.onmessage = function (event) {
    if (event.data === 'releaseSubmit') {
      formSubmitting = false;
      submitButton.disabled = false;
    }
    /*
    if(event.data === 'submitForm') {

    }
    */
  };
} else {
  form.addEventListener('submit', onFormSubmit);
}

/** @enum number */
const CheckTypeReturn = {
  ERROR: 0,
  SUCCESS: 1,
  WHAT: 2
};

const ACCEPT_OCTET_STREAM = false;

const nnidInput = document.getElementById('nnid');
const nnidDataInput = document.getElementById('nnid-data');
const nnidRandomButton = document.getElementById('random-nnid');
const nnidLoaded = document.getElementById('nnid-loaded');
const nnidLastModified = document.getElementById('nnid-last-modified');
let nnidDebounceTimeout;

const pnidInput = document.getElementById('pnid');
const pnidDataInput = document.getElementById('pnid-data');
const pnidLoaded = document.getElementById('pnid-loaded');
let pnidDebounceTimeout;

// disable last modified display for google bc it shows that as the page
// last modified date and that probably did not help seo whoooops
const disableLastModified = /Googlebot/.test(navigator.userAgent);

/**
 *
 * @param {string} apiUrl
 * @param {HTMLInputElement} nnidInput
 * @param {HTMLElement} nnidLoaded
 * @param {HTMLInputElement} nnidDataInput
 * @param {HTMLElement} nnidLastModified
 * @returns {Promise<void>}
 */
async function handleNNIDDataFetch(apiUrl, nnidInput, nnidLoaded, nnidDataInput, nnidLastModified) {
  const headers = ACCEPT_OCTET_STREAM ? { Accept: 'application/octet-stream' } : {};
  return fetch(apiUrl, { headers })
    .then(async (response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(text);
        });
      }
      if (ACCEPT_OCTET_STREAM && response.headers.get('Content-Type') === 'application/octet-stream') {
        return response.arrayBuffer().then(buffer => ({
          data: new Uint8Array(buffer),
          lastModified: response.headers.get('Last-Modified')
        }));
      }
      return response.json().then((data) => {
        return Object.assign({}, data, {
          lastModified: data.images && data.images.last_modified
        });
      });
    })
    .then((data) => {
      nnidLoaded.style.display = 'none';
      if (nnidLastModified) {
        nnidLastModified.style.display = 'none';
      }

      let decodedData;
      if (data.data instanceof Uint8Array) {
        decodedData = data.data;
      } else {
        if (typeof data.error === 'string') {
          throw new TypeError(data.error);
        } else if (!data.data) {
          throw new Error('No data attribute in response');
        }
        decodedData = base64ToBytes(data.data);
        if (data.user_id) {
          nnidInput.value = data.user_id;
        }
        // NOTE: means this effectively ONLY passes in data when ACCEPT_OCTET_STREAM is DISABLED!!!!!!!!
        nnidDataInput.value = data.data;
      }

      const type = findSupportedTypeBySize(decodedData.length);

      const checkResult = checkSupportedTypeBySize(decodedData, type, globalThis.globalVerifyCRC16);
      if (checkResult) {
        nnidInput.setCustomValidity('');

        // Extract and show Mii name
        displayNameFromSupportedType(decodedData, nnidLoaded, type, (checkResult === 2));

        // Show last modified date if available
        if (data.lastModified && nnidLastModified &&
          !disableLastModified
        ) {
          nnidLastModified.style.display = '';
          nnidLastModified.firstElementChild.textContent =
            new Date(data.lastModified).toLocaleString();
        }
      } else {
        const errorText = document.querySelector('[id^="data-error-"]:not([style*="none"])').textContent;
        nnidInput.setCustomValidity(errorText || 'Invalid data');
      }
    });
}

nnidInput.addEventListener('input', function () {
  clearTimeout(nnidDebounceTimeout);

  nnidDebounceTimeout = setTimeout(function () {
    const nnidValue = nnidInput.value.trim();
    const apiUrl = nnidInput.dataset.action + nnidValue;

    if (nnidValue.length > 0) {
      handleNNIDDataFetch(apiUrl, nnidInput, nnidLoaded, nnidDataInput, nnidLastModified)
        .catch((error) => {
          nnidInput.setCustomValidity(error.message);
          nnidInput.reportValidity();
        })
        .finally(() => {
          if (!formSubmitting) {
            nnidInput.disabled = false;
            submitButton.disabled = false;
            nnidRandomButton.disabled = false;
          }
        });
    } else {
      nnidInput.setCustomValidity('');
      nnidInput.reportValidity();
    }
  }, 500); // 500ms debounce
});

pnidInput.addEventListener('input', function () {
  clearTimeout(pnidDebounceTimeout);

  pnidDebounceTimeout = setTimeout(function () {
    const pnidValue = pnidInput.value.trim();
    const apiUrl = pnidInput.dataset.action + pnidValue +
      '?api_id=1';

    if (pnidValue.length > 0) {
      handleNNIDDataFetch(apiUrl, pnidInput, pnidLoaded, pnidDataInput)
        .catch((error) => {
          pnidInput.setCustomValidity(error.message);
          pnidInput.reportValidity();
        })
        .finally(() => {
          if (!formSubmitting) {
            pnidInput.disabled = false;
            submitButton.disabled = false;
          }
        });
    } else {
      pnidInput.setCustomValidity('');
      pnidInput.reportValidity();
    }
  }, 600); // 600ms debounce
});

const getErrorLi = () => {
  const errorLiOriginal = document.getElementsByClassName('load-error');
  // get last error li, the original
  // eslint-disable-next-line unicorn/prefer-at -- does not work on this collection type
  const errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
  return errorLi;
};

nnidRandomButton.addEventListener('click', function () {
  const apiUrl = nnidRandomButton.dataset.action;
  nnidInput.disabled = true;
  submitButton.disabled = true;
  nnidRandomButton.disabled = true;

  handleNNIDDataFetch(apiUrl, nnidInput, nnidLoaded, nnidDataInput, nnidLastModified)
    .catch((error) => {
      // Create and append the error message
      const errorLi = getErrorLi();
      errorLi.style.display = '';
      errorLi.textContent = error.message;
      resultList.insertBefore(errorLi, resultList.firstChild);
    })
    .finally(() => {
      if (!formSubmitting) {
        nnidInput.disabled = false;
        submitButton.disabled = false;
        nnidRandomButton.disabled = false;
        nnidInput.focus();
      }
    });
});


globalThis.globalVerifyCRC16 = true;

const verifyCRC16Checkbox = document.getElementById('verifyCRC16');
verifyCRC16Checkbox.addEventListener('change', function () {
  globalThis.globalVerifyCRC16 = !this.checked;
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

/**
 * @param {Uint8Array} data
 * @param {import('./common.js').SupportedTypeDefinition} type
 * @returns {string|boolean|null}
 */
function getNameFromSupportedType(data, type) {
  if (!type) {
    return false;
  }

  if (!type.offsetName) {
    return null;
  }
  // specifically return null for no offset name
  // so that the next function uses the type name instead

  // Use the new extractUTF16Text function to get the name string
  const nameString = extractUTF16Text(data, type.offsetName, type.isNameU16BE, type.nameLength);

  return nameString;
}

/**
 * @param {Uint8Array} data
 * @param {HTMLSpanElement} nameElement
 * @param {import('./common.js').SupportedTypeDefinition} type
 * @param {boolean} crc16NotPassed
 * @returns {boolean}
 */
function displayNameFromSupportedType(data, nameElement, type, crc16NotPassed) {
  if (!type) {
    return false;
  }

  const nameString = getNameFromSupportedType(data, type);

  // Handle the case where there's no offsetName
  nameElement.firstElementChild.textContent =
    // use the type name if the name is null (type has no name offset)
    nameString === null ? type.name : nameString;

  nameElement.style.display = '';
  if (crc16NotPassed) {
    nameElement.style.color = 'red';
    nameElement.firstElementChild.textContent += crc16ChecksumFailedText.textContent;
  } else if (type.offsetCRC16) {
    nameElement.style.color = 'green';
  } else {
    // color that means no crc16 supported
    nameElement.style.color = 'olivedrab';
  }
  return true;
}

// file type input
const fileInput = document.getElementById('file');
const fileDataInput = document.getElementById('file-data');
const fileDataReal = document.getElementById('file-data-real');
const fileLoaded = document.getElementById('file-loaded');

// select an error element that is visible
// visible = does not have (display: )none
const errorTextQuery = '[id^="data-error-"]:not([style*="none"]';

// handle adding form input on file input, or fail
fileInput.addEventListener('input', function () {
  if (!fileInput || !fileInput.files[0]) {
    return;
  }
  // remove mii name and input value
  fileLoaded.style.display = 'none';
  fileDataInput.value = '';
  fileDataReal.disabled = true;
  // clear validity
  fileInput.setCustomValidity('');
  dataInput.setCustomValidity('');
  const reader = new FileReader();
  reader.addEventListener('load', function (e) {
    // When file is read, replace/add the 'data' parameter with the file content in Base64
    /** Remove the 'data:;base64,' part */
    const base64Data = e.target.result.split(',')[1];
    // decode so we can verify it and read the mii name
    const data = base64ToBytes(base64Data);

    const type = findSupportedTypeBySize(data.length);

    // this function will handle errors, showing and returning false
    // if there are no errors it should pass tho
    const checkResult = checkSupportedTypeBySize(data, type, globalThis.globalVerifyCRC16);
    if (!checkResult) {
      // remove file to invalidate the form
      // fileInput.value = '';
      const errorText = document.querySelector(errorTextQuery).textContent;
      if (errorText) {
        fileInput.setCustomValidity(errorText);
      }
      // fileInput.setCustomValidity('foobar');
      // do not mark success
      return;
    }
    // assuming success
    fileDataInput.value = base64Data;
    setDataConvertInline(data, type, fileDataInput, fileDataReal);
    // if(data.length != 96) return;
    // extract name and show loaded text
    displayNameFromSupportedType(data, fileLoaded, type, (checkResult === 2));
  });
  reader.readAsDataURL(fileInput.files[0]);
  return;
});

const dataInput = document.getElementById('data');
const dataInputReal = document.getElementById('data-real');
const dataLoaded = document.getElementById('data-loaded');

// same but for base64 mii data
dataInput.addEventListener('input', function () {
  // remove mii name
  dataLoaded.style.display = 'none';
  dataInputReal.disabled = true;
  // unset validity on both fields
  fileInput.setCustomValidity('');
  dataInput.setCustomValidity('');
  // ignore if is not base64
  if (dataInput.validity.patternMismatch) {
    return;
  }

  // if a url that resembles a studio url with data
  // is passed in then literally parse it and remove the rest
  try {
    if (dataInput.value.includes('data=')) {
      const url = new URL(dataInput.value);
      const dataParam = url.searchParams.get('data');
      if (dataParam &&
        // NOTE: make sure it is as long
        // as studio url data, encoded (only.)
        dataParam.length === 94
      ) {
        // set the input value to that directly, removing everything else
        dataInput.value = dataParam;
      }
    }
  } catch (error) {
    console.warn('error while trying to strip what we thought was a studio url bc it had "data=" in it:', error);
  }

  // TODO TRY AND CATCH THIS BLOCK
  // decode so we can verify it and read the mii name
  let data;
  try {
    data = parseHexOrB64ToBytes(dataInput.value);
  } catch (error) {
    dataInput.setCustomValidity('We tried to decode as hex and Base64 and failed at both: ' + error);
    return;
  }

  const type = findSupportedTypeBySize(data.length);

  // this function will handle errors, showing and returning false
  // if there are no errors it should pass tho
  const checkResult = checkSupportedTypeBySize(data, type, globalThis.globalVerifyCRC16);
  if (!checkResult) {
    // remove file to invalidate the form
    const errorText = document.querySelector(errorTextQuery).textContent;
    if (errorText) {
      dataInput.setCustomValidity(errorText);
    }
    // do not mark success
    return;
  }
  // assuming success
  setDataConvertInline(data, type, dataInput, dataInputReal);

  // extract name and show loaded text
  displayNameFromSupportedType(data, dataLoaded, type, (checkResult === 2));
  return;
});

// Active input management
let activeInput = null;

/** hide all file statuses/errors whenever you switch input types */
function hideAllErrors() {
  for (const element of document.querySelectorAll('[id^="data-error-"]')) {
    element.style.display = 'none';
  }
}

/**
 * Helper function to set active input.
 * @param {HTMLInputElement} input
 */
function setActiveInput(input) {
  activeInput = input;
  /** .closest('.input-switch-container'); */
  const parent = input.parentElement;
  // Update classes and names for all inputs in the data group
  for (const inp of document.querySelectorAll('#data-group input')) {
    // if this input isn't the active input...
    if (inp !== activeInput && // and
      // is not a sibling of the current input?
      inp.parentElement !== parent) {
      // disable this input!
      inp.classList.remove('green-border');
      if (inp.name) {
        inp.dataset.nameDisabled = inp.name;
        inp.removeAttribute('name');
        inp.setCustomValidity('');
      }
    } else {
      inp.classList.add('green-border');
      if (inp.dataset.nameDisabled) {
        inp.setAttribute('name', inp.dataset.nameDisabled);
        delete inp.dataset.nameDisabled;
      }
    }
  }

  // if you didn't just upload a file just now...
  // and if the file has a file input but not data...
  // un-upload a file bc that means there was an error
  if (activeInput !== fileInput && !fileDataInput.value && fileInput.value) {
    fileInput.value = '';
  }

  // hideAllErrors();
}

/**
 *
 * @param {HTMLDivElement} parent
 * @param {string} dataString
 */
function fillNameInDetailsFromDataString(parent, dataString) {
  const firstSummaryInParent = parent.getElementsByTagName('summary')[0];
  const nameFieldElement = firstSummaryInParent.firstElementChild;
  // assuming the top are defined   all well and good and yes.

  const data = parseHexOrB64ToBytes(dataString);
  const type = findSupportedTypeBySize(data.length);
  // asssuuumiiinggg it will always be supported
  const nameString = getNameFromSupportedType(data, type);

  nameFieldElement.textContent =
    nameString === null ? type.name : nameString;

  // if name string is falsey (null) then STOP HERE!
  // bc it will set it to a string "null"
  if (!nameString) {
    return;
  }
  // set data-name to be objective name which can be blank
  const firstDetailsInParent = parent.getElementsByTagName('details')[0];
  firstDetailsInParent.dataset.name = nameString;
}

// Event listener for file input
fileInput.addEventListener('input', function () {
  if (fileInput.files.length > 0) {
    setActiveInput(fileInput);
  }
});

// Event listener for data input
dataInput.addEventListener('input', function () {
  if (dataInput.value.trim() !== '') {
    setActiveInput(dataInput);
  }
});

// Event listeners for labels
document.querySelector('label[for="file"]').addEventListener('click', function () {
  if (fileInput.files.length > 0) {
    setActiveInput(fileInput);
  }
});

document.querySelector('label[for="data"]').addEventListener('click', function () {
  if (dataInput.value.trim() !== '') {
    setActiveInput(dataInput);
  }
});

const inputTypeSelect = document.getElementById('input-type');

/** Updates visibility of data type categories. */
function updateVisibility() {
  hideAllErrors();

  // Retrieve the selected value from the dropdown.
  const selectedValue = inputTypeSelect.value;

  // Loop through all options in the dropdown.
  for (const option of Array.from(inputTypeSelect.options)) {
    const group = document.getElementById(option.value + '-group');
    // Skip if no group element is found.
    if (!group) {
      continue;
    }

    // Determine if this group should be visible.
    const isVisible = option.value === selectedValue;
    group.style.display = isVisible ? '' : 'none';

    // Update all input elements within the group.
    for (const input of Array.from(group.getElementsByTagName('input'))) {
      // if it's NOT visible, disable it
      input.disabled = !isVisible;
      // input.required = isVisible;
      // fire input trigger to invoke validation
      if (isVisible) {
        input.dispatchEvent(new Event('input'));
      }
    }
  }
}

/**
 * Function to get a cookie's value by name.
 * @param {string} name
 * @returns {string|null}
 */
function getCookie(name) {
  const cookieArr = document.cookie.split(';');
  for (let i = 0; i < cookieArr.length; i++) {
    const cookiePair = cookieArr[i].split('=');
    if (name == cookiePair[0].trim()) {
      return decodeURIComponent(cookiePair[1]);
    }
  }
  return null;
}

/**
 * Function to set a cookie.
 * @param {string} name
 * @param {string} value
 * @param {number} days
 */
function setCookie(name, value, days) {
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/';
}

// when this script is loaded...
// const selectElement = document.getElementById('input-type');

if (!iframeMode) {
  // Check if a value is already stored in localStorage
  /** localStorage.getItem('selectedInputType'); */
  const storedValue = getCookie('selectedInputType');
  // set value to that (before updating the form)
  if (storedValue) {
    inputTypeSelect.value = storedValue;
  }
}

// Initially call the function to set the correct state based on the preselected option
updateVisibility();

// Add an event listener to the select element to update visibility upon change
inputTypeSelect.addEventListener('change', function () {
  if (!iframeMode) {
    setCookie('selectedInputType', this.value, 7);
  } // Cookie will last for 7 days
  // localStorage.setItem('selectedInputType', this.value);
  // before updating visibility
  updateVisibility();
});

if (!iframeMode) {
  // connect the error reporting sse channel when you first open the page
  connectErrorReportingSSE();

  loadSpecifiedFieldsFromLocalStorage();
}

/**
 * @param {Uint8Array|Array<number>} data
 * @param {import('./common.js').SupportedTypeDefinition} type
 * @param {boolean} checkCRC16
 * @returns {CheckTypeReturn}
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
    return CheckTypeReturn.ERROR;
  }

  if (type.offsetCRC16) {
    const dataCrc16 = data.slice(type.offsetCRC16, type.offsetCRC16 + 2);
    const dataCrc16u16 = (dataCrc16[0] << 8) | dataCrc16[1];
    const expectedCrc16 = crc16(data.slice(0, type.offsetCRC16));

    if (expectedCrc16 !== dataCrc16u16) {
      if (checkCRC16) {
        fileErrorInvalidChecksum.style.display = '';
        return CheckTypeReturn.ERROR;
      } else {
        // TODO returns a third type
        return CheckTypeReturn.WHAT;
      }
    }
  }

  return CheckTypeReturn.SUCCESS;
}

/**
 *
 * @param {Uint8Array} data
 * @param {import('./common.js').SupportedTypeDefinition} type
 * @param {HTMLInputElement} dataField
 * @param {HTMLInputElement} dataRealField
 */
function setDataConvertInline(data, type, dataField, dataRealField) {
  if (!type.specialCaseConvertTo || dataRealField === undefined) {
    // ig it is already set
    // dataField.value = uint8ArrayToBase64(data);
    return;
  }

  // convert to stuuuuuudioooooo

  // run the function to convert the data from the image to raw studio data
  // NOTE: assuming function and studioFormat const are already defined
  const studioData = convertDataToType(data, studioFormat);
  // "studio code" = raw studio data in hex
  // NOTE: three dots are only required if it is a uint8array which
  // it is only one if the input data is studio data directly
  const studioCode = bytesToHex(studioData);

  // set data field
  dataField.value = studioCode;

  // set real value that will be read by conversion
  dataRealField.disabled = false;
  dataRealField.value = bytesToBase64(data);
}

globalThis.setDataConvertInline = setDataConvertInline;

const pantsColor = document.getElementById('pantsColor');
const pantsColorsWithSwitchShaderInaccurate = document.getElementById('pants-colors-with-switch-shader-inaccurate');

pantsColor.addEventListener('change', function () {
  pantsColorsWithSwitchShaderInaccurate.style.display = shaderType.value === 'switch' &&
    pantsColor.value === 'red' && pantsColor.value == 'blue'
    ? ''
    : 'none';
});

globalThis.nfpDidLoadCallback = (storeData, input, inputReal, loadedElement) => {
  // TODO: stub
  const type = findSupportedTypeBySize(storeData.length);
  // NOTE: all of the below just serves to check storedata crc16
  // as well as display name. that is fiiinee for that but
  // not for either displaying or conversion

  // this function will handle errors, showing and returning false
  // if there are no errors it should pass tho
  const checkResult = checkSupportedTypeBySize(storeData, type, globalThis.globalVerifyCRC16);
  if (!checkResult) {
    // remove file to invalidate the form
    const errorText = document.querySelector(errorTextQuery).textContent;
    if (errorText) {
      input.setCustomValidity(errorText);
    }
    // do not mark success
    return;
  }
  // extract name and show loaded text
  displayNameFromSupportedType(storeData, loadedElement, type, (checkResult === 2));

  setDataConvertInline(storeData, type, input, inputReal);
}

/**
 * wario land 3
 * @returns {boolean|string}
 */
function arianHandler() {
  // Get the path to complicated.html from a meta tag in the current document
  const metaComplicatedHtml = document.querySelector('meta[itemprop=arianhandler-html-path]');
  if (!metaComplicatedHtml || !metaComplicatedHtml.content) {
    alert('arianHandler HTML tag not found so we cannot initiate Wario Land 3 :(');
    return false;
  }
  const complicatedHtmlPath = metaComplicatedHtml.content;

  fetch(complicatedHtmlPath)
    .then((response) => {
      if (!response.ok) {
        // Throw an error with response status and statusText
        throw new Error(
          'HTTP Error: ' + response.status + ' ' + response.statusText
        );
      }
      return response.text();
    })
    .then((html) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.append(div);

      // Determine the ROM URL based on the current document's language
      const romMetaName = document.documentElement.lang.startsWith('es') ? 'rom-path-es' : 'rom-path';
      const romUrl = div.querySelector('meta[name=' + romMetaName + ']').content;

      // Start fetching the ROM and store the promise in a global variable
      window['romPromise'] = fetch(romUrl).then(response => response.arrayBuffer());

      // Load the scripts defined in complicated.html
      const scripts = div.getElementsByTagName('script');
      for (const script of Array.from(scripts)) {
        if (script.src) {
          const newScript = document.createElement('script');
          newScript.src = script.src;
          document.head.append(newScript);
        }
      }
    });
  return true;
}

/**
 * @param {MouseEvent} event
 * @param {Uint8Array} [data]
 * @param {string} [paramsToRemove]
 * @throws {Error} Throws when the image to copy or its src is null/undefined.
 */
const handleCopyButtonAndUpdateText = (event, data, paramsToRemove) => {
  // do not visit the link or submit the button
  event.preventDefault();

  /**
   * this function handles removing query param/params from the url
   * @param {string} url
   * @param {Array<string>} params
   * @returns {string}
   */
  const removeQueryParams = (url, params) => {
    const urlObj = new URL(url);
    if (Array.isArray(params)) {
      for (const param of params) {
        urlObj.searchParams.delete(param);
      }
    } else {
      urlObj.searchParams.delete(params);
    }
    return urlObj.toString();
  };

  // this function assumes... that this is the anchor...
  const target = event.currentTarget;
  // and that the anchor is in a parent element
  // and to act on the img if there is no data
  const parent = target.parentElement;

  // if there is data then just return that as a string
  if (data === undefined) {
    // there is one img in the parent, where we want to copy the src element
    const img = parent.getElementsByTagName('img')[0];
    if (!img || !img.src) { // is it undefined, null, or empty?
      throw new Error('when you clicked the copy button for the studio render, ' +
        'and we tried to find the image\'s source, it ended up as undefined...???');
    } else {
      // begin copying
      // before that tho, if the paramsToRemove argument
      // is passed in then remove that as a query param
      let srcToCopy = img.src;
      if (paramsToRemove) {
        srcToCopy = removeQueryParams(srcToCopy, paramsToRemove);
      }
      // copy :)
      navigator.clipboard.writeText(srcToCopy);
    }
  } else {
    navigator.clipboard.writeText(data);
    // NOTE: not used for anything rn
  }

  // ... and THEN, there is a counter.
  // the counter increases on every copy
  // and copying once hides the text and unhides the counter
  const textCopyElement = parent.getElementsByClassName('text-copy')[0];
  textCopyElement.style.display = 'none';
  const textCopiedElement = parent.getElementsByClassName('text-copied')[0];
  // the counter number is the only span inside of here
  /* const textCounterNumberElement = textCounterElement.firstElementChild;
  // pretend it's a number when it's a string and then increment it
  textCounterNumberElement.textContent++;
  */
  textCopiedElement.style.display = '';
};
