document.addEventListener('DOMContentLoaded', () => {
    const spinner = document.getElementById('loader');

    // Function to show the loader
    const showLoader = () => {
        spinner.style.display = 'flex';  // Show the loader
    };

    // Function to hide the loader
    const hideLoader = () => {
        spinner.style.display = 'none';  // Hide the loader
    };
    // Function to display error messages for specific form fields
    const displayErrors = (fieldId, message) => {
        const errorElement = document.getElementById(`${fieldId}Error`);
        if (errorElement) {
            errorElement.textContent = message;
        }
    };

    // Function to clear all error messages
    const clearErrors = () => {
        document.querySelectorAll('.error-message').forEach((error) => {
            error.textContent = '';
        });
    };

    // Function to validate the address form fields
    const validateAddressForm = () => {
        const address = document.getElementById('address').value.trim();
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('state').value.trim();
        const zipCode = document.getElementById('zipCode').value.trim();

        let isValid = true;
        clearErrors(); // Clear previous errors

        // Validate address
        if (address === '') {
            displayErrors('address', 'Address is required.');
            isValid = false;
        }

        // Validate city
        if (city === '') {
            displayErrors('city', 'City is required.');
            isValid = false;
        }

        // Validate state
        if (state === '') {
            displayErrors('state', 'State is required.');
            isValid = false;
        }

        // Validate zip
        if (zipCode === '') {
            displayErrors('zipCode', 'ZIP code is required.');
            isValid = false;
        }

        return isValid;
    };

    // Function to handle form submission with AJAX
    const handleFormSubmit = async (form, endpoint) => {
        showLoader();

        const csrfToken = document.querySelector('input[name="_csrf"]').value;
        const formData = new FormData(form);
        const jsonData = JSON.stringify(Object.fromEntries(formData));

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'CSRF-Token': csrfToken 
                },
                body: jsonData
            });

            const data = await response.json();

            hideLoader();

            // Handle successful form submission
            if (data.success) {
                Swal.fire({
                    icon: "success",
                    title: "Success!",
                    text: data.message,
                    background: "#d4edda",
                    confirmButtonColor: "#28a745",
                    confirmButtonText: "Ok"
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.reload(); // Reload page to reflect changes
                    }
                });
            } else {
                // Handle error in form submission
                Swal.fire({
                    icon: "error",
                    title: "Oops...",
                    text: data.message,
                    background: "#f8d7da",
                    confirmButtonColor: "#d33"
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.reload(); // Reload page to reflect changes
                    }
                });
            }
        } catch (err) {
            hideLoader();

            console.error("Error submitting form:", err);
            
            Swal.fire({
                icon: "error",
                title: "Oops...",
                text: err.message || "An unexpected error occurred. Please try again later."
            });
        }
    };

    // Handle form submission for adding/updating address
    const addressForm = document.getElementById('address-form');
    if (addressForm) {
        addressForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent default form submission

            const isValid = validateAddressForm();

            if (isValid) {
                const isEdit = document.getElementById('addressId').value;
                const endpoint = isEdit ? '/users/address-management/update' : '/users/address-management/add';
                handleFormSubmit(addressForm, endpoint);
            }
        });
    }

    // Handle editing address
    const editAddress = (id, address, city, state, zipCode) => {
        document.getElementById('addressTitle').textContent = 'Edit Address';
        document.getElementById('addressButton').textContent = 'Update Address';
        document.getElementById('addressId').value = id;
        document.getElementById('address').value = address;
        document.getElementById('city').value = city;
        document.getElementById('state').value = state;
        document.getElementById('zipCode').value = zipCode;
        document.getElementById('address-form').setAttribute('action', '/users/address-management/update');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle deleting address
    const deleteAddress = async (id) => {
        const csrfToken = document.querySelector('input[name="_csrf"]').value;

        try {
            const response = await fetch('/users/address-management/delete', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ addressId: id })
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire({
                    icon: "success",
                    title: "Deleted!",
                    text: data.message,
                    background: "#d4edda",
                    confirmButtonColor: "#28a745",
                    confirmButtonText: "Ok"
                }).then(() => {
                    window.location.reload(); // Reload page to reflect changes
                });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Oops...",
                    text: data.message,
                    background: "#f8d7da",
                    confirmButtonColor: "#d33"
                });
            }
        } catch (err) {
            console.error("Error deleting address:", err);
            
            Swal.fire({
                icon: "error",
                title: "Oops...",
                text: err.message || "An unexpected error occurred. Please try again later."
            });
        }
    };

    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-address-btn').forEach((button) => {
        button.addEventListener('click', (event) => {
            const id = button.getAttribute('data-id');
            const address = button.getAttribute('data-address');
            const city = button.getAttribute('data-city');
            const state = button.getAttribute('data-state');
            const zipCode = parseInt(button.getAttribute('data-zipCode'), 10);
            editAddress(id, address, city, state, zipCode);
        });
    });

    document.querySelectorAll('.delete-address-btn').forEach((button) => {
        button.addEventListener('click', (event) => {
            const { id } = event.target.dataset;
            
            Swal.fire({
                icon: 'warning',
                title: 'Are you sure?',
                text: 'This will permanently delete the address.',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then(result => {
                if (result.isConfirmed) {
                    deleteAddress(id);
                }
            });
        });
    });
});