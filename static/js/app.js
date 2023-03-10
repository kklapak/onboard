$(document).ready(() => {
  addProductCheckboxes();

  const searchbar = $('#search-bar');
  var customerInput = $("input[name='customer']");

  searchbar.select2({ dropdownAutoWidth: true, width: 'auto'})
  $('.select2-container').hide()

  var token = localStorage.getItem('token');
  var cf_auth = localStorage.getItem('cf_auth');

  if (token) {
    $('#token').val(token);
  }
  if (cf_auth) {
    $('#cf_auth').val(cf_auth);
  }

  $('#token').blur(function(){
      $(".select2-container").hide();
      $("#loading").show();
      token = $('#token').val()
     // console.log("Jira Token " + token)
      get_onboard_jiras(token,cf_auth)
      localStorage.setItem('token', $('#token').val())
  });

  $('#cf_auth').blur(function(){
      $(".select2-container").hide();
      $("#loading").show();
      cf_auth = $('#cf_auth').val()
    //  console.log("cf_auth " + cf_auth)
      get_onboard_jiras(token,cf_auth)
      localStorage.setItem('cf_auth', $('#cf_auth').val())
  });

 // console.log("Jira Token " + token)
//  console.log("cf_auth " + cf_auth)
  get_onboard_jiras(token,cf_auth)
  console.log("Ready")

  const searchCall = () => {
    const selectedValue = $("#search-bar").val();
    if (selectedValue !== ''){
        $('#message').html('<p><strong>Epic Link:</strong><a href="https://jira.cfdata.org/browse/' + selectedValue + '" target="_blank">'+ selectedValue +'</a>');
    }
    if (selectedValue) {
      if (selectedValue !== ''){
          console.log('Sending POST request...');
          $.ajax({
            url: '/lookup_jira',
            type: 'POST',
            data: { selected_value: selectedValue, token: token, cf_auth: cf_auth },
            dataType: 'json',
            success: function(data) {
              console.log(data)
              updateForm(data)
              console.log("Sent data")
            }
          });
      }else{
        resetForm();
      }
    } else {
      resetForm();
    }
  };

  const resetForm = () => {
    $("#create_epic")[0].reset();
    $('.form-check-input').prop('checked', false);
    $('#create_epic').find('*').prop('disabled', false);
    $("button[id='submit']").show();
    $("button[id='update']").hide();
    $("#create_epic").show();
  };

  searchbar.on('change', searchCall);
  searchbar.load(searchCall);

  searchbar.on('select2:select', (e) => {
    const { id: value, text } = e.params.data;
    searchbar.val(value);
  });

  $('button[type="submit"]').click(function() {
        // Set the value of the clicked button in a hidden input field
        $('#submit-action').val($(this).attr('name'));
  });

  $('#create_epic').on('submit', function(event) {
        // Prevent the form from submitting
        event.preventDefault();
        console.log("Creating Epic")

        var token = $('#token').val();
        var cf_auth = $('#cf_auth').val();
        console.log(token,cf_auth)

        var submitName = $('#submit-action').val();
        console.log(submitName)

        // Get the form data
        var formData = $(this).serializeArray();
        formData.push({name:'cf_auth',value: cf_auth});
        formData.push({name:'token',value: token});
        formData.push({name:'action',value: submitName});

        // Get the value of the linked field
        console.log(formData)

        var message = $('#message');

        $(this).find(':input').prop('disabled', true);
        console.log('Sending POST request...');
          $.ajax({
            url: '/',
            type: 'POST',
            data: formData,
            dataType: 'json',
            success: function(response) {
              console.log(response)
              $('#create_epic').find(':input').prop('disabled', false);
              if (response["errors"] === 'undefined'){
                  message.text('Issue created successfully').removeClass('error').addClass('success').show();
              }
              else if (response["status"] === 'success'){
                  get_onboard_jiras(token,cf_auth);
                  message.html('<p><strong>Epic ID:</strong><a href="https://jira.cfdata.org/browse/' + response.epic_id + '" target="_blank">'+ response.epic_id +'</a>');
                  message.append('<p><strong>Projects:</strong> ' + response.projects.join(', ') + '</p>');
                  message.append('<p><strong>Status:</strong> ' + response.status + '</p>');
                  message.removeClass('error').addClass('success').show();
                  $('#search-bar').val(response.epic_id)
                  $('#search-bar').trigger('change');
              } else{
                message.text("Error: " + JSON.stringify(response["errors"]));
              }
            },
            error: function(xhr, textStatus, errorThrown) {
                $('#create_epic').find(':input').prop('disabled', false);
                console.error('Error:', xhr.responseText);
            }
          });

      });

});

function get_onboard_jiras(token,cf_auth){
  console.log("Grabbing ONBOARD Epics")
  $.ajax({
    url: '/get-onboards',
    type: 'POST',
    data: { token: token, cf_auth: cf_auth },
    async: false,
    dataType: 'json',
    success: (data) => {
      console.log(data)
      if (data["user"] !== undefined){
          $("#user").text("User: " + data["user"]["key"])
      }
      else{
         $("#user").text("User: ")
      }
      $('#search-bar').empty();
      $('#search-bar').append('<option value="">Create New</option>')
      if (data["epics"] !== undefined) {
          data["epics"].forEach(({ key, summary }) => {
            const optionText = `(${key}) ${summary}`;
            $('#search-bar').append($('<option>', { text: optionText, value: key }));
          });
          $("#loading").hide();
          $(".select2-container").show();;
      }
      else{
          $(".select2-container").hide();
          $("button[id='submit']").hide();
          $("button[id='update']").hide();
          $("#user").text(data.error)
          $("#loading").text(data.error)
          $("#loading").show();
      }
    },
  });
}

function updateForm(data) {
  const epicExistsInput = $("input[name='epic_exists']");
  const epicIdInput = $("input[name='epic_id']");
  const submitButton = $("button[id='submit']");
  const updateButton = $("button[id='update']");
  const descriptionTextarea = $("textarea[name='description']");
  const checkboxInputs = $('.form-check-input');
  const regionSelect = $("#region");

  for (const [key, value] of Object.entries(data)) {
    switch (key) {
       case "epic_id":
        if (value != null) {
          epicExistsInput.val("true");
          epicIdInput.val(value);
          submitButton.hide();
          updateButton.show();
        }
        break;

      case "description":
        if (value != null) {
          descriptionTextarea.val(value).prop('disabled', true);
        } else {
          descriptionTextarea.val("").prop('disabled', false);
        }
        break;

      case "products":
        checkboxInputs.each(function() {
          const checkboxValue = $(this).attr('name');
          const objectInArray = value.includes(checkboxValue);
          $(this).prop('checked', objectInArray).prop('disabled', objectInArray);
        });
        break;

      case "region":
        regionSelect.val(value).prop('disabled', true);
        break;

      default:
        const input = $(`input[name='${key}']`);
        if (value == null) {
          input.val("").prop('disabled', false);
        } else {
          input.val(value).prop('disabled', true);
        }
        break;
    }
    //console.log(`${key}: ${value}`);
  }
}

function addProductCheckboxes(){

 // Define an array of product names
    const products = ["Access", "Analytics", "API Gateway", "Area 1", "Argo", "Bot Management","Browser Isolation",
    "CASB","CDN","China Network","Cloudflare Stream", "Data Localization", "DDoS Protection",
    "DNS","Email Routing","Gateway","Identity","Images", "Load Balancing", "Logs", "Magic Firewall", "Magic Transit",
    "Magic WAN", "Network Interconnect (CNI)", "Page Shield", "Pages", "Premium Success","R2","Rate Limiting","Spectrum",
    "SSL / TLS Encryption", "SSL / TLS for SaaS Providers", "Tunnel","WAF","Waiting Room","WARP","Website Optimization Services",
    "Workers", "Workers KV", "Zaraz", "Zero Trust"];

    // Get the product list container element
    const productList = document.getElementById("product-list-1");
    const productList2 = document.getElementById("product-list-2");

    // Loop through the products array and create a checkbox for each product

    column = 1
    for (let i = 0; i < products.length; i++) {
      // Create a new product div
      const newProductDiv = document.createElement("div");
      newProductDiv.classList.add("form-check");

      // Create a new product checkbox
      const newProductCheckbox = document.createElement("input");
      newProductCheckbox.classList.add("form-check-input");
      newProductCheckbox.setAttribute("type", "checkbox");
      newProductCheckbox.setAttribute("name", products[i]);
      newProductCheckbox.setAttribute("id", products[i]);

      // Create a new product label
      const newProductLabel = document.createElement("label");
      newProductLabel.classList.add("form-check-label");
      newProductLabel.setAttribute("for", products[i]);
      newProductLabel.textContent = products[i];

      // Add the new product checkbox and label to the new product div
      newProductDiv.appendChild(newProductCheckbox);
      newProductDiv.appendChild(newProductLabel);

      // Add the new product div to the product list container element
      if(i > Math.round(products.length/2)) {
        productList2.appendChild(newProductDiv);
      } else{
         productList.appendChild(newProductDiv);
      }

    }
}