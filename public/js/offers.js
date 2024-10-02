document.addEventListener('DOMContentLoaded', () => {
    const productOfferForm = document.getElementById('product-offer-form');
    const categoryOfferForm = document.getElementById('category-offer-form');
    const csrfToken = document.querySelector('input[name="_csrf"]').value;

    const displayErrors = (formId, fieldId, message) => {
        const errorElement = document.getElementById(`${formId}-${fieldId}Error`);
        if (errorElement) {
            errorElement.textContent = message;
        }
    };

    // Function to clear all error messages
    const clearErrors = (formId) => {
        document.querySelectorAll(`#${formId} .error-message`).forEach((error) => {
            error.textContent = '';
        });
    };

    const validateProductOfferForm = () => {
        let isValid = true;

        clearErrors('product-offer-form');

        const fixedDiscount = document.getElementById('fixedDiscount').value.trim();
        const percentageDiscount = document.getElementById('percentageDiscount').value.trim();
        const offerExpirationDate = document.getElementById('offerExpirationDate').value;
        const minimumPurchaseAmount = document.getElementById('minimumPurchaseAmount').value.trim();
        const expirationDate = new Date(offerExpirationDate);
        const currentDate = new Date();

        if (fixedDiscount && (isNaN(fixedDiscount) || fixedDiscount < 0)) {
            displayErrors('product-offer-form', 'fixedDiscount', 'Fixed discount must be a valid positive number.');
            isValid = false;
        }

        if (percentageDiscount && (isNaN(percentageDiscount) || percentageDiscount < 0)) {
            displayErrors('product-offer-form', 'percentageDiscount', 'Percentage discount must be a valid positive number.');
            isValid = false;
        }

        if (isNaN(minimumPurchaseAmount) || minimumPurchaseAmount < 0) {
            displayErrors('product-offer-form', 'minimumPurchaseAmount', 'Minimum purchase amount must be a valid positive number.');
            isValid = false;
        }

        if (!offerExpirationDate) {
            displayErrors('product-offer-form', 'offerExpirationDate', 'Offer expiration date is required.');
            isValid = false;
        }

        if (expirationDate <= currentDate) {
            displayErrors('product-offer-form', 'offerExpirationDate', 'Expiration date must be in the future.');
            isValid = false;
        }

        return isValid;
    };

    const validateCategoryOfferForm = () => {
        let isValid = true;

        clearErrors('category-offer-form');

        const fixedDiscount = document.getElementById('categoryFixedDiscount').value.trim();
        const percentageDiscount = document.getElementById('categoryPercentageDiscount').value.trim();
        const offerExpirationDate = document.getElementById('categoryOfferExpirationDate').value;
        const minimumPurchaseAmount = document.getElementById('categoryMinimumPurchaseAmount').value.trim();
        const expirationDate = new Date(offerExpirationDate);
        const currentDate = new Date();

        if (fixedDiscount && (isNaN(fixedDiscount) || fixedDiscount < 0)) {
            displayErrors('category-offer-form', 'categoryFixedDiscount', 'Fixed discount must be a valid positive number.');
            isValid = false;
        }

        if (percentageDiscount && (isNaN(percentageDiscount) || percentageDiscount < 0)) {
            displayErrors('category-offer-form', 'categoryPercentageDiscount', 'Percentage discount must be a valid positive number.');
            isValid = false;
        }

        if (isNaN(minimumPurchaseAmount) || minimumPurchaseAmount < 0) {
            displayErrors('category-offer-form', 'categoryMinimumPurchaseAmount', 'Minimum purchase amount must be a valid positive number.');
            isValid = false;
        }

        if (!offerExpirationDate) {
            displayErrors('category-offer-form', 'categoryOfferExpirationDate', 'Offer expiration date is required.');
            isValid = false;
        }

        if (expirationDate <= currentDate) {
            displayErrors('category-offer-form', 'categoryOfferExpirationDate', 'Expiration date must be in the future.');
            isValid = false;
        }

        return isValid;
    };

    if (productOfferForm) {
        productOfferForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const isValidProductForm = validateProductOfferForm();

            if (isValidProductForm) {
                try {
                    const formData = new FormData(productOfferForm);
                    const data = Object.fromEntries(formData.entries());
                    const response = await fetch('/admin/products/offers/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(data)
                    });

                    const result = await response.json();

                    if (result.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: result.message
                        }).then(() => {
                            window.location.href = '/admin/offers';
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: result.message
                        });
                    }
                } catch (error) {
                    console.error('Error:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'An error occurred while processing the request'
                    });
                }
            }
        });
    }

    if (categoryOfferForm) {
        categoryOfferForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const isValidCategoryForm = validateCategoryOfferForm();

            if (isValidCategoryForm) {
                try {
                    const formData = new FormData(categoryOfferForm);
                    const data = Object.fromEntries(formData.entries());
                    const response = await fetch('/admin/categories/offers/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(data)
                    });

                    const result = await response.json();

                    if (result.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: result.message
                        }).then(() => {
                            window.location.href = '/admin/offers';
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: result.message
                        });
                    }
                } catch (error) {
                    console.error('Error:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'An error occurred while processing the request'
                    });
                }
            }
        });
    }
});
    