document.addEventListener("DOMContentLoaded", function() {
    const reviewButton = document.getElementById('rate-product-button'); // The review button

    if (reviewButton) {
        reviewButton.addEventListener('click', async function(event) {
            event.preventDefault(); // Prevent the default anchor click behavior
    
            const productId = this.dataset.productId; // Extract the productId from data attribute
            const isLoggedIn = document.querySelector('#userLinks').getAttribute('data-is-logged-in') === 'true';
    
            // Check if the user is logged in
            if (!isLoggedIn) {
                try {
                    const result = await Swal.fire({
                        title: 'Login Required',
                        text: 'You need to be logged in to review the product. Would you like to log in now?',
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonText: 'Login',
                        cancelButtonText: 'Cancel'
                    });
    
                    if (result.isConfirmed) {
                        window.location.href = '/users/login';  // Redirect to login page
                    }
                } catch (error) {
                    console.error("Error displaying SweetAlert:", error);
                }
    
                return;  // Stop further execution if not logged in
            }
    
            // If logged in, check eligibility
            try {
                const response = await fetch(`/products/rate-product/${productId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content') // CSRF token for security
                    }
                });
    
                // Check if the response is an HTML page or a JSON object
                const contentType = response.headers.get("content-type");
    
                if (response.ok) {
                    if (contentType && contentType.includes("application/json")) {
                        const data = await response.json();
                        
                        if (data.eligible) {
                            // Redirect to the review page directly if the user is eligible
                            window.location.href = `/products/rate-product/${productId}`;
                        } else {
                            // Show warning if not eligible
                            Swal.fire({
                                title: 'Not Eligible',
                                text: data.message, // Show the message from the server response
                                icon: 'warning' // Show a warning icon
                            });
                        }
                    } else {
                        // If the response is not JSON, handle it as an HTML page (e.g., it has been rendered)
                        window.location.href = `/products/rate-product/${productId}`;  // Redirect to the product rating page
                    }
                } else {
                    // Handle server-side errors distinctly
                    throw new Error('Error while checking eligibility');
                }
            } catch (error) {
                // Handle any client-side or network errors
                Swal.fire({
                    title: 'Error',
                    text: error.message,
                    icon: 'error'
                });
            }        
        });
    }

    // Utility function to display errors
    const displayErrors = (fieldId, message) => {
        const errorElement = document.getElementById(`${fieldId}-error`);
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

    // Utility function for validation
    const validateReviewForm = () => {
        let isValid = true;

        // Clear previous error messages
        clearErrors();

        // Get form values
        const rating = document.querySelector('input[name="rating"]:checked');
        const comment = document.querySelector('textarea[name="comment"]').value.trim();

        // Validation rules
        if (!rating) {
            displayErrors('rating', 'Please select a rating.');
            isValid = false;
        }
        if (!comment) {
            displayErrors('comment', 'Comment cannot be empty.');
            isValid = false;
        }

        return isValid;
    };

    // Add event listener to the form
    document.getElementById('reviewForm').addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the default form submission

        // Validate the form
        if (!validateReviewForm()) {
            return; // Stop submission if validation fails
        }

        const csrfToken = document.querySelector('input[name="_csrf"]').value;
        const productId = document.querySelector('input[name="productId"]').value;
        const comment = document.querySelector('.rating-comment').value; // Ensure to get the comment value

        try {
            // If validation passes, send the form data
            const response = await fetch(`/products/rate-product/${productId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    rating: document.querySelector('input[name="rating"]:checked').value,
                    comment: comment,
                }),
            });

            const result = await response.json();
            if (response.ok) {
                // Show success message with SweetAlert
                await Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: result.message,
                });
                // Optionally, clear the form inputs here
                document.getElementById('reviewForm').reset();
                clearErrors(); // Clear any error messages
            } else {
                // Show error message with SweetAlert
                await Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: result.message,
                });
            }
        } catch (error) {
            // Handle network errors or other unexpected errors
            console.error('Error:', error);
            await Swal.fire({
                icon: 'error',
                title: 'Network Error',
                text: 'There was a problem submitting your review. Please try again later.',
            });
        }
    });
});