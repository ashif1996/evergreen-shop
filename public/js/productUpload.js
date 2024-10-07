document.addEventListener('DOMContentLoaded', () => {
    const displayError = (fieldId, message) => {
        const errorElement = document.getElementById(`${fieldId}Error`);

        if (errorElement) {
            errorElement.textContent = message;
        }
    };
    
    const clearErrors = () => {
        document.querySelectorAll('.error-message').forEach((error) => {
            error.textContent = '';
        });
    };

    const validateProductForm = (isEdit = false) => {
        console.log("Form validation initiated");
        const productName = document.getElementById('name').value.trim();
        const price = document.getElementById('price').value.trim();
        const description = document.getElementById('description').value.trim();
        const availableStock = document.getElementById('stock').value.trim();
        const category = document.getElementById('category').value;
        const availability = document.getElementById('availability').value;
        const images = document.getElementById('images').files;
    
        let isValid = true;
    
        clearErrors();
    
        if (!productName) {
            displayError('name', 'Product name is required.');
            isValid = false;
        } else if (!/^[a-zA-Z\s]+$/.test(productName)) {
            displayError('name', 'Product name must be a valid name.');
            isValid = false;
        }
    
        if (!price || isNaN(price) || price <= 0) {
            displayError('price', 'Price must be a valid number greater than 0.');
            isValid = false;
        }
    
        if (!description) {
            displayError('description', 'Description is required.');
            isValid = false;
        }
    
        if (!availableStock || isNaN(availableStock) || availableStock < 0) {
            displayError('stock', 'Available stock must be a valid number.');
            isValid = false;
        }
    
        if (!category) {
            displayError('category', 'Please select a category.');
            isValid = false;
        }
    
        if (!availability) {
            displayError('availability', 'Please select availability.');
            isValid = false;
        }
    
        if (!isEdit) {
            if (images.length === 0) {
                displayError('images', 'At least one image is required.');
                isValid = false;
            } else {
                // Validate each image file
                for (const file of images) {
                    if (!file.type.startsWith('image/')) {
                        displayError('images', 'Only image files are allowed.');
                        isValid = false;
                    }
                    if (file.size > 5 * 1024 * 1024) { // Limit file size to 5MB
                        displayError('images', 'Image size should not exceed 5MB.');
                        isValid = false;
                    }
                }
            }
        } else {
            // Validate each image file
            for (const file of images) {
                if (!file.type.startsWith('image/')) {
                    displayError('images', 'Only image files are allowed.');
                    isValid = false;
                }
                if (file.size > 5 * 1024 * 1024) { // Limit file size to 5MB
                    displayError('images', 'Image size should not exceed 5MB.');
                    isValid = false;
                }
            }
        }
    
        return isValid;
    };
    
    const handleFormSubmit = async (form, endpoint, method = 'POST') => {
        console.log("Form submission initiated");
        const csrfToken = document.querySelector('input[name="_csrf"]').value;
    
        clearErrors();
    
        const formData = new FormData(form);
    
        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'CSRF-Token': csrfToken
                },
                body: formData
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.errors) {
                    // Display each error on the relevant field
                    for (const [field, message] of Object.entries(errorData.errors)) {
                        displayError(field, message);
                    }
                    return;
                }
                throw new Error(errorData.message || 'Unknown error');
            }
    
            const data = await response.json();
    
            if (data.success) {
                Swal.fire({
                    icon: "success",
                    title: "Success!",
                    text: data.message,
                    background: "#d4edda",
                    confirmButtonColor: "#28a745",
                    confirmButtonText: "Ok"
                }).then(() => {
                    window.location.href = data.redirectUrl;
                });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Oops...",
                    text: data.message,
                    background: "#f8d7da",
                    confirmButtonColor: "#d33"
                }).then(() => {
                    window.location.href = data.originalUrl;
                });
            }
        } catch (error) {
            console.error('Error:', error);

            Swal.fire({
                icon: "error",
                title: "Oops...",
                text: error.message || 'Error adding the product. Please try again later or contact support if the issue persists.'
            });
        }
    };    

    // Add Product Form
    const addForm = document.getElementById('add-product-form');
    if (addForm) {
        addForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const isValidAddProductForm = validateProductForm();
            if (isValidAddProductForm) {
                handleFormSubmit(addForm, '/admin/add-products', 'POST');
            }
        });
    }

    // Edit Product Form
    const editForm = document.getElementById('edit-product-form');
    if (editForm) {
        console.log("Edit Form found");
        editForm.addEventListener('submit', (event) => {
            event.preventDefault();
            console.log("Edit Form submit event triggered");

            const isValidEditProductForm = validateProductForm(true);
            if (isValidEditProductForm) {
                const productId = editForm.getAttribute('data-product-id');
                handleFormSubmit(editForm, `/admin/edit-products/${productId}`, 'PUT');
            }
        });
    }
});