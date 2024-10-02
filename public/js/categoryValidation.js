document.addEventListener('DOMContentLoaded', () => {
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

    // Function to validate the category form fields
    const validateCategoryForm = () => {
        const categoryName = document.getElementById("categoryName").value.trim();
        const status = document.getElementById("status").value;
        const description = document.getElementById("description").value.trim();

        let isValid = true;
        clearErrors(); // Clear previous errors

        // Validate category name
        if (categoryName === '') {
            displayErrors('categoryName', 'Category name is required.');
            isValid = false;
        } else if (categoryName.length < 3 || categoryName.length > 20) {
            displayErrors('categoryName', 'Category name must be between 3 and 20 characters.');
            isValid = false;
        } else if (!/^[a-zA-Z\s]+$/.test(categoryName)) {
            displayErrors('categoryName', 'Category name contains invalid characters.');
            isValid = false;
        }

        // Validate status
        if (status === 'select') {
            displayErrors('status', 'Please select a status for the category.');
            isValid = false;
        }

        // Validate description
        if (description === '') {
            displayErrors('description', 'Description is required.');
            isValid = false;
        } else if (description.length < 10 || description.length > 1500) {
            displayErrors('description', 'Description must be between 10 and 1500 characters.');
            isValid = false;
        }

        return isValid;
    };

    // Function to handle form submission with AJAX
    const handleFormSubmit = async (form, endpoint) => {
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

            // Handle successful form submission
            if (data.success) {
                Swal.fire({
                    icon: "success",
                    title: "Success!",
                    text: data.message,
                    background: "#d4edda",
                    confirmButtonColor: "#28a745",
                    confirmButtonText: "Ok"
                }).then(() => {
                    window.location.href = "/admin/categories";
                });
            } else {
                // Handle error in form submission
                Swal.fire({
                    icon: "error",
                    title: "Oops...",
                    text: data.message,
                    background: "#f8d7da",
                    confirmButtonColor: "#d33"
                });
            }
        } catch (err) {
            console.error("Error submitting form:", err);
            
            Swal.fire({
                icon: "error",
                title: "Oops...",
                text: err.message || "An unexpected error occurred. Please try again later."
            });
        }
    };

    // Get the category form element
    const categoryForm = document.getElementById('categoryForm');

    // Add event listener for form submission
    if (categoryForm) {
        categoryForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent default form submission

            const isValidCategoryForm = validateCategoryForm();

            if (isValidCategoryForm) {
                const isEdit = document.getElementById('categoryId').value;
                const endpoint = isEdit ? '/admin/update-category': '/admin/add-category';
                handleFormSubmit(categoryForm, endpoint);
            }
        });
    }

    // Add event listeners for edit category buttons
    document.querySelectorAll('.edit-category-btn').forEach((button) => {
        button.addEventListener('click', (event) => {
            const { id, name, status, description } = event.target.dataset;
            editCategory(id, name, status, description);
        });
    });

    // Add event listeners for toggle category buttons
    document.querySelectorAll('.toggle-category-btn').forEach((button) => {
        button.addEventListener('click', (event) => {
            const { id, name, status } = event.target.dataset;
            const isListed = status === 'true';

            const actionText = isListed ? 'unlist' : 'list';
            const actionMessage = isListed ? 'This will make the category unavailable to users.' : 'This will make the category available to users.';

            Swal.fire({
                icon: 'warning',
                title: `Are you sure you want to ${actionText} ${name} category?`,
                text: actionMessage,
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes'
            }).then(result => {
                if (result.isConfirmed) {
                    toggleCategory(id);
                }
            });
        });
    });

    // Function to populate the form fields for editing a category
    const editCategory = (id, name, status, description) => {
        const formTitle = document.getElementById('formTitle');
        const formButton = document.getElementById('formButton');
        const categoryIdInput = document.getElementById('categoryId');
        const categoryNameInput = document.getElementById('categoryName');
        const statusSelect = document.getElementById('status');
        const descriptionTextarea = document.getElementById('description');

        if (formTitle && formButton && categoryIdInput && categoryNameInput && statusSelect && descriptionTextarea) {
            formTitle.textContent = 'Edit Category';
            formButton.textContent = 'Update Category';
            categoryIdInput.value = id;
            categoryNameInput.value = name;
            statusSelect.value = status;
            descriptionTextarea.value = description;
            document.getElementById('categoryForm').setAttribute('action', '/admin/update-category');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            console.error('One or more form elements not found.');
        }
    };

    // Function to toggle the category status
    const toggleCategory = async (id) => {
        // Get CSRF token from meta tag
        const csrfMetaToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        try {
            const response = await fetch(`/admin/toggle-category/${id}`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'X-CSRF-Token': csrfMetaToken
                }
            });

            const data = await response.json();

            // Handle successful category toggle
            if (data.success) {
                Swal.fire({
                    icon: "success",
                    title: "Success!",
                    text: data.message,
                    background: "#d4edda",
                    confirmButtonColor: "#28a745",
                    confirmButtonText: "Ok"
                }).then(() => {
                    window.location.reload();
                });
            } else {
                // Handle error in category toggle
                Swal.fire({
                    icon: "error",
                    title: "Oops...",
                    text: data.message,
                    background: "#f8d7da",
                    confirmButtonColor: "#d33"
                });
            }
        } catch (err) {
            console.error("Error toggling category:", err);
            Swal.fire({
                icon: "error",
                title: "Oops...",
                text: err.message || "An unexpected error occurred. Please try again later."
            });
        }
    };
});