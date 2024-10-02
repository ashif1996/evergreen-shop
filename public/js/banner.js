document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('banner-form');
    
    form.addEventListener('submit', async function (e) {
        e.preventDefault(); // Prevent default form submission
        
        // Clear previous error messages
        clearErrors();

        // Get CSRF token from hidden input field
        const csrfToken = form.querySelector('input[name="_csrf"]').value;

        // Get form values
        const title = document.getElementById('title').value.trim();
        const imageFile = document.getElementById('imageUrl').files[0];
        const description = document.getElementById('description').value.trim();
        const isActive = document.getElementById('isActive').checked;

        let isValid = true;

        // Title validation
        if (!title) {
            showError('titleError', 'Title is required');
            isValid = false;
        } else if (title.length < 3) {
            showError('titleError', 'Title must be at least 3 characters long');
            isValid = false;
        }

        // Image URL validation
        if (!imageFile) {
            showError('imageUrlError', 'Banner image is required');
            isValid = false;
        } else if (!imageFile.type.startsWith('image/')) {
            showError('imageUrlError', 'Please upload a valid image file (JPG, PNG, GIF)');
            isValid = false;
        } else if (imageFile.size > 5 * 1024 * 1024) { // 5MB limit
            showError('imageUrlError', 'Image file size should not exceed 5MB');
            isValid = false;
        }

        // Description validation (optional)
        if (description.length > 500) { // Max length 500 characters
            showError('descriptionError', 'Description cannot exceed 500 characters');
            isValid = false;
        }

        // Form submission if all fields are valid
        if (isValid) {
            try {
                const formData = new FormData(form);
                
                const response = await fetch('/admin/banners/add', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'CSRF-Token': csrfToken // Send CSRF token in headers
                    }
                });

                const data = await response.json();

                if (data.success) {
                    await Swal.fire({
                        title: 'Success!',
                        text: 'Banner added successfully!',
                        icon: 'success',
                        confirmButtonText: 'OK'
                    });
                    window.location.href = '/admin/banners'; // Redirect to banners list
                } else {
                    await Swal.fire({
                        title: 'Error!',
                        text: data.message || 'Something went wrong.',
                        icon: 'error',
                        confirmButtonText: 'OK'
                    });
                }
            } catch (error) {
                console.error('Error:', error);
                await Swal.fire({
                    title: 'Error!',
                    text: 'An unexpected error occurred.',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        }
    });

    function showError(id, message) {
        document.getElementById(id).innerText = message;
    }

    function clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.innerText = '');
    }
});