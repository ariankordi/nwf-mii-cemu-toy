// Select elements based on their names and ids
var resolutionNumber = document.getElementsByName('width')[0];
var widthSlider = document.getElementById('resolution-slider');
var bgColor = document.getElementsByName('bgColor')[0];
var transparentCheckbox = document.getElementById('transparent-checkbox');

var bgDefault = '#00ff00'//bgColor.value;

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

var scaleInput = document.getElementsByName('scale')[0];
var realMax = 1080;
// Function to update max resolution based on scale
function updateMaxResolution() {
  var scale = parseInt(scaleInput.value, 10);
  var maxResolution = realMax / scale;

  // Adjust current values if they exceed the new max
  if(widthSlider.value > maxResolution) {
    widthSlider.value = maxResolution;
    //debugger;
    resolutionNumber.value = maxResolution;
  }

  widthSlider.max = maxResolution;
  resolutionNumber.max = maxResolution;
}

// Listen for changes in the scale input to update max resolution
scaleInput.addEventListener('input', updateMaxResolution);

// Initial setup - apply the correct maximums based on the initial scale value
updateMaxResolution();

// assumes there is only ONE form on the page or at least the one we want is the first one
var form = document.forms[0];
var resultList = document.getElementById('results');

form.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent the default form submission via HTTP
  var submitButton = form.querySelector('input[type=submit]');
  submitButton.disabled = true; // Disable the button
  submitButton.setAttribute('value', submitButton.getAttribute('data-value'));

  // Check if file input is present and has a file
  var fileInput = document.getElementById('file');
  if(fileInput && fileInput.files[0]) {
    var reader = new FileReader();
    reader.onload = function(e) {
      // When file is read, replace/add the 'data' parameter with the file content in Base64
      var base64Data = e.target.result.split(',')[1]; // Remove the 'data:*/*;base64,' part
      var formData = new FormData(form);
      formData.set('data', base64Data); // Replace or add 'data' parameter with the file's Base64 content
      var params = new URLSearchParams(formData).toString();
      createAndAppendImage(params);
    };
    reader.readAsDataURL(fileInput.files[0]);
    return;
  }
  // Proceed normally if no file is selected
  var formData = new FormData(form);
  var params = new URLSearchParams(formData).toString();
  createAndAppendImage(params);

  function createAndAppendImage(params) {
    // request image from form action
    var imageBase = form.action;

    var imageUrl = imageBase + '?' + params;

    // Create and append the <img> element
    var img = document.createElement('img');
    img.src = imageUrl;
    img.onerror = function(e) {
      // Handle image loading error
      var errorLiOriginal = document.getElementsByClassName('load-error');
      // get last error li, the original
      var errorLi = errorLiOriginal[errorLiOriginal.length - 1].cloneNode(true);
      errorLi.style.display = '';

      submitButton.disabled = false; // Re-enable the button
      submitButton.removeAttribute('value');

      errorLi.appendChild(img); // Append the <img> inside of the the error li
      resultList.insertBefore(errorLi, resultList.firstChild); // Insert at the top
    };
    img.onload = function() {
      // Re-enable the button upon successful image load
      submitButton.disabled = false;
      submitButton.removeAttribute('value');

      img.className += ' fade-in'; // Add the fade-in class
      // Insert the new <li> at the top of the list
      var li = document.createElement('li');
      li.appendChild(img); // Append the <img> to the <li>
      resultList.insertBefore(li, resultList.firstChild);
      // remove on successful load
      var tutorial = document.getElementById('tutorial');
      tutorial && tutorial.remove();
    };
  }
});

var inputTypeSelect = document.getElementById('input_type');

// Function to update the visibility and state (disabled/enabled, required/not required) of grouped inputs based on a selected value from a dropdown.
/*function updateVisibility() {
  // Retrieve the selected value from the dropdown.
  var selectedValue =
    inputTypeSelect.options[inputTypeSelect.selectedIndex].value;
  var options = inputTypeSelect.options;

  // Loop through all options in the dropdown.
  for (var i = 0; i < options.length; i++) {
    var optionValue = options[i].value;
    var group = document.getElementById(optionValue + '-group');
    // If no group element is found, skip the rest of this loop iteration.
    if(!group) continue;
    // Find the first input element within the group and store it in a variable.
    //var input = group.getElementsByTagName('input')[0];
    var input = document.getElementById(optionValue) || group.getElementsByTagName('input')[0];
    // Check if the current option value matches the selected value from the dropdown.
    if(optionValue === selectedValue) {
      // If it's a match, show the associated group element.
      group.style.display = '';
      // Enable this input element, allowing the user to interact with it.
      input.disabled = false;
      continue;
    }
    // If the current option value does not match the selected value, hide the associated group element.
    group.style.display = 'none';
    //input = group.getElementsByTagName('input')[0];
    input.disabled = true;
  }
}*/
function updateVisibility() {
  // Retrieve the selected value from the dropdown.
  var selectedValue = inputTypeSelect.value;

  // Loop through all options in the dropdown.
  Array.from(inputTypeSelect.options).forEach(option => {
    var group = document.getElementById(option.value + '-group');
    // Skip if no group element is found.
    if(!group) return;

    // Determine if this group should be visible.
    var isVisible = option.value === selectedValue;
    group.style.display = isVisible ? '' : 'none';

    // Update all input elements within the group.
    Array.from(group.getElementsByTagName('input')).forEach(input => {
      input.disabled = !isVisible;
      //input.required = isVisible;
    });
  });
}


// Initially call the function to set the correct state based on the preselected option
updateVisibility();

// Add an event listener to the select element to update visibility upon change
inputTypeSelect.addEventListener('change', updateVisibility);
