$(function() {
    const searchbar = $('#search-bar');
    const customerInput = $("input[name='customer']");
    const productList1 = $('#product-list-1');
    const productList2 = $('#product-list-2');

    let token = localStorage.getItem('token') || '';
    let cf_auth = localStorage.getItem('cf_auth') || '';

    const addProductCheckboxes = () => {
        const products = ["Access", "Analytics", "API Gateway", "Area 1", "Argo", "Bot Management", "Browser Isolation", "CASB", "CDN", "China Network", "Cloudflare Stream", "Data Localization", "DDoS Protection", "DNS", "Email Routing", "Gateway", "Identity", "Images", "Load Balancing", "Logs", "Magic Firewall", "Magic Transit", "Magic WAN", "Network Interconnect (CNI)", "Page Shield", "Pages", "Premium Success", "R2", "Rate Limiting", "Spectrum", "SSL / TLS Encryption", "SSL / TLS for SaaS Providers", "Tunnel", "WAF", "Waiting Room", "WARP", "Website Optimization Services", "Workers", "Workers KV", "Zaraz", "Zero Trust"];
        let count = 0
        for (const product of products) {
            const newProductDiv = $('<div>', {
                class: 'form-check',
                html: $('<input>', {
                    class: 'form-check-input',
                    type: 'checkbox',
                    name: product,
                    id: product
                }).add($('<label>', {
                    class: 'form-check-label',
                    for: product,
                    text: product
                }))
            });
            if(count <= Math.round(products.length/2)){
                productList1.append(newProductDiv);
                count+=1
            }else{
                productList2.append(newProductDiv);
                count+=1
            }
        }
    };

    // Fetch onboard Jiras function
    const getOnboardJiras = async () => {
        try {
            $("#overlay").fadeIn();
            $(".select2-container").hide();
            $("#loading").show();
            token = $('#token').val();
            cf_auth = $('#cf_auth').val();

            // Get onboard Jiras
            console.log('Getting onboard Jiras...');
            const response = await $.ajax({
                url: '/get-onboards',
                type: 'POST',
                data: {
                    token,
                    cf_auth
                },
                dataType: 'json',
                success: function (){
                  $("#message").empty();
                }
            });

            // Update UI with onboard Jiras
            console.log('Updating UI with onboard Jiras...');
            $('#search-bar').empty();
            $('#search-bar').append($('<option>', {
                text: 'Create New',
                value: ''
            }));
            if (response.epics) {
                response.epics.forEach(({
                    key,
                    summary
                }) => {
                    const optionText = `(${key}) ${summary}`;
                    $('#search-bar').append($('<option>', {
                        text: optionText,
                        value: key
                    }));
                });
                $(".select2-container").show();
            } else {
                $(".select2-container").hide();
                $('#message').text(response.error).removeClass('success').addClass('error').show();
            }

            // Update UI with user info
            console.log('Updating UI with user info...');
            if (response.user) {
                $('#user').text(`User: ${response.user.key}`);
            } else {
                $('#user').text('User: ');
            }

            // Hide loading overlay
            console.log('Hiding loading overlay...');
            $("#loading").hide();
            $("#overlay").fadeOut();
        } catch (err) {
            console.error('Error:', err.responseText);
        }
    };

    const searchCall = async () => {
        const selectedValue = searchbar.val();
        if (!selectedValue) {
            resetForm();
            return;
        }

        console.log('Sending POST request...');
        try {
            const data = await $.ajax({
                url: '/lookup_jira',
                type: 'POST',
                data: {
                    selected_value: selectedValue,
                    token: token,
                    cf_auth: cf_auth
                },
                dataType: 'json'
            });

            console.log('Data:', data);
            updateForm(data);
        } catch (err) {
            console.error('Error:', err.responseText);
        }
    };

    const resetForm = () => {
        $('#create_epic')[0].reset();
        $('.form-check-input').prop('checked', false);
        $('#create_epic').find('*').prop('disabled', false);
        $('#submit').show();
        $('#update').hide();
        $('#create_epic').show();
    };

    const updateForm = (data) => {
        const epicExistsInput = $("input[name='epic_exists']");
        const epicIdInput = $("input[name='epic_id']");
        const submitButton = $('#submit');
        const updateButton = $('#update');
        const descriptionTextarea = $("textarea[name='description']");
        const checkboxInputs = $('.form-check-input');
        const regionSelect = $('#region');
        for (const [key, value] of Object.entries(data)) {
            if (value === null) continue;

            switch (key) {
                case 'epic_id':
                    epicExistsInput.val('true');
                    epicIdInput.val(value);
                    submitButton.hide();
                    updateButton.show();
                    break;

                case 'description':
                    descriptionTextarea.val(value).prop('disabled', true);
                    break;

                case 'products':
                    checkboxInputs.each(function() {
                        const checkboxValue = $(this).attr('name');
                        const objectInArray = value.includes(checkboxValue);
                        $(this).prop('checked', objectInArray).prop('disabled', objectInArray);
                    });
                    break;

                case 'region':
                    regionSelect.val(value).prop('disabled', true);
                    break;

                default:
                    $(`input[name='${key}']`)
                        .val(value)
                        .prop('disabled', true);
                    break;
            }
        }
    };

    $('#token').on('blur', async function() {
        $('#overlay').fadeIn();
        $('.select2-container').hide();
        $('#loading').show();

        cf_auth = $(this).val();
        localStorage.setItem('cf_auth', cf_auth);

        console.log('Fetching onboard Jiras...');
        await getOnboardJiras();
    });

    $(document).ready(() => {
        // Add product checkboxes
        addProductCheckboxes();

        // Initialize search bar
        const searchbar = $('#search-bar');
        searchbar.select2({
            dropdownAutoWidth: true,
            width: 'auto'
        });
        $('.select2-container').hide();

        // Load saved tokens
        const token = localStorage.getItem('token');
        const cf_auth = localStorage.getItem('cf_auth');
        if (token) {
            $('#token').val(token);
        }
        if (cf_auth) {
            $('#cf_auth').val(cf_auth);
        }

        // Fetch onboard Jiras on page load
        console.log('Fetching onboard Jiras on page load...');
        getOnboardJiras();

        // Fetch onboard Jiras on token blur
        $('#token').blur(() => {
            console.log('Fetching onboard Jiras on token blur...');
            localStorage.setItem('token', $('#token').val());
            getOnboardJiras();
        });

        // Fetch onboard Jiras on cf_auth blur
        $('#cf_auth').blur(() => {
            console.log('Fetching onboard Jiras on cf_auth blur...');
            localStorage.setItem('cf_auth', $('#cf_auth').val());
            getOnboardJiras();
        });

        // Handle search bar change
        const searchCall = () => {
            const selectedValue = searchbar.val();
            if (selectedValue !== '') {
                $('#message').html('<p><strong>Epic Link:</strong><a href="https://jira.cfdata.org/browse/' + selectedValue + '" target="_blank">' + selectedValue + '</a>')
                $('#message').removeClass('error').addClass('success').show();
            } else {
                resetForm();
            }
            if (selectedValue) {
                console.log('Sending POST request...');
                $("#overlay").fadeIn();
                $.ajax({
                    url: '/lookup_jira',
                    type: 'POST',
                    data: {
                        selected_value: selectedValue,
                        token,
                        cf_auth
                    },
                    dataType: 'json',
                    success: (data) => {
                        console.log(data);
                        updateForm(data);
                        $("#overlay").fadeOut();
                        console.log("Sent data");
                    },
                    error: (xhr, textStatus, errorThrown) => {
                        console.error('Error:', xhr.responseText);
                        $("#overlay").fadeOut();
                    }
                });
            } else {
                resetForm();
            }
        };

        // Handle search bar events
        searchbar.on('change', searchCall);
        searchbar.load(searchCall);
        searchbar.on('select2:select', (e) => {
            const {
                id: value,
                text
            } = e.params.data;
            searchbar.val(value);
        });

        // Handle submit button click
        $('button[type="submit"]').click(() => {
            // Set the value of the clicked button in a hidden input field
            $('#submit-action').val($(this).attr('name'));
        });

        // Handle form submit
        $('#create_epic').on('submit', (event) => {
            // Prevent the form from submitting
            event.preventDefault();
            console.log('Creating Epic...');
            // Get the form data
            const formData = $('#create_epic').serializeArray();
            formData.push({
                name: 'cf_auth',
                value: cf_auth
            });
            formData.push({
                name: 'token',
                value: token
            });
            formData.push({
                name: 'action',
                value: $('#submit-action').val()
            });

            // Disable form inputs and show loading overlay
            $('#create_epic')
                .find(':input')
                .prop('disabled', true);
            $("#overlay").fadeIn();

            // Send POST request to create epic
            console.log('Sending POST request...');
            $.ajax({
                url: '/',
                type: 'POST',
                data: formData,
                dataType: 'json',
                success: (response) => {
                    console.log(response);
                    $('#create_epic').find(':input').prop('disabled', false);
                    if (response.errors === undefined) {
                        $('#message')
                            .text('Issue created successfully')
                            .removeClass('error')
                            .addClass('success')
                            .show();
                    } else if (response.status === 'success') {
                        getOnboardJiras();
                        const {
                            epic_id,
                            projects,
                            status
                        } = response;
                        $('#message').html('<p><strong>Epic ID:</strong><a href="https://jira.cfdata.org/browse/' + response.epic_id + '" target="_blank">'+ response.epic_id +'</a>');
                        $('#message').append('<p><strong>Projects:</strong> ' + response.projects.join(', ') + '</p>');
                        $('#message').append('<p><strong>Status:</strong> ' + response.status + '</p>');
                        $('#message').removeClass('error').addClass('success').show();
                        searchbar.val(epic_id);
                        searchbar.trigger('change');
                    } else {
                        $('#message').text("Error: " + JSON.stringify(response["errors"]));
                    }
                    $("#overlay").fadeOut();
                },
                error: (xhr, textStatus, errorThrown) => {
                    console.error('Error:', xhr.responseText);
                    $('#create_epic').find(':input').prop('disabled', false);
                    $("#overlay").fadeOut();
                }
            });

        });

        // Animate dots in loading message
        const animateDots = () => {
            const dots = $('.dots');
            setInterval(() => {
                dots.each(function() {
                    $(this).text($(this).text() + '.');
                    if ($(this).text().length > 3) {
                        $(this).text('.');
                    }
                });
            }, 500);
        };
        animateDots();
    });
});