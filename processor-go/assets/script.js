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
    var scale = parseInt(scaleInput.value);
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
  submitButton.setAttribute('value', submitButton.getAttribute('data-value')); // Change "value" key to "data-value"

  // Check if file input is present and has a file
  var fileInput = document.getElementById('file');
  if (fileInput && fileInput.files[0]) {
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
      var errorLi = errorLiOriginal[errorLiOriginal.length-1].cloneNode(true);
      errorLi.style.display = '';
  
      submitButton.disabled = false; // Re-enable the button
      submitButton.removeAttribute('value'); // Revert "data-value" to "value"
  
      errorLi.appendChild(img); // Append the <img> inside of the the error li
      resultList.insertBefore(errorLi, resultList.firstChild); // Insert at the top
    };
    img.onload = function() {
      // Re-enable the button upon successful image load
      submitButton.disabled = false;
      submitButton.removeAttribute('value'); // Revert "data-value" to "value"
  
      img.className += ' fade-in'; // Add the fade-in class
      // Insert the new <li> at the top of the list
      var li = document.createElement('li');
      li.appendChild(img); // Append the <img> to the <li>
      resultList.insertBefore(li, resultList.firstChild);
    };
  }
});





  var inputTypeSelect = document.getElementById('input_type');

  function updateVisibility() {
    var selectedValue = inputTypeSelect.options[inputTypeSelect.selectedIndex].value;
    var options = inputTypeSelect.options;

    for(var i = 0; i < options.length; i++) {
      var optionValue = options[i].value;
      var group = document.getElementById(optionValue + '-group');
      if(!group) continue;
      if(optionValue === selectedValue) {
        group.style.display = ''; // Show the selected group
        var input = group.getElementsByTagName('input')[0];
        input.disabled = false; // Enable its input
				input.required = true;
        continue;
      }
      group.style.display = 'none'; // Hide other groups
      var input = group.getElementsByTagName('input')[0];
      input.disabled = true; // Disable their inputs
      input.required = false;
    }
  }

  // Initially call the function to set the correct state based on the preselected option
  updateVisibility();

  // Add an event listener to the select element to update visibility upon change
  inputTypeSelect.addEventListener('change', updateVisibility);
