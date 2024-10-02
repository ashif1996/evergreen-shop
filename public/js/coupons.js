document.addEventListener('DOMContentLoaded', function () {
    // Utility function to display errors
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

    // Utility function for validation
    const validateCouponForm = () => {
        let isValid = true;
        
        // Clear previous error messages
        clearErrors();

        // Get form values
        const code = document.getElementById('code').value.trim();
        const discountType = document.getElementById('discountType').value;
        const discountValue = document.getElementById('discountValue').value.trim();
        const minimumPurchaseAmount = document.getElementById('minimumPurchaseAmount').value.trim();
        const expirationDate = document.getElementById('expirationDate').value;

        // Validation rules
        if (!code || !/^[a-zA-Z0-9]{3,}$/.test(code)) {
            displayErrors('code', 'Coupon code must be at least 3 characters long and contain only letters and numbers');
            isValid = false;
        }
        if (!discountType) {
            displayErrors('discountValue', 'Discount type is required');
            isValid = false;
        }
        if (!discountValue || isNaN(discountValue) || discountValue <= 0) {
            displayErrors('discountValue', 'Valid discount value is required');
            isValid = false;
        }
        if (minimumPurchaseAmount && (isNaN(minimumPurchaseAmount) || minimumPurchaseAmount < 0)) {
            displayErrors('minimumPurchaseAmount', 'Valid minimum purchase amount is required');
            isValid = false;
        }
        if (!expirationDate) {
            displayErrors('expirationDate', 'Expiration date is required');
            isValid = false;
        }

        return isValid;
    }

    // Utility function for handling form submissions
    const handleFormSubmit = async (form, url, method, successRedirectUrl) => {
        if (!validateCouponForm()) return; // Perform validation before submitting

        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': data._csrf
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
                    window.location.href = successRedirectUrl;
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

    // Add Coupon Form Submission
    const addCouponForm = document.getElementById('add-coupon-form');
    if (addCouponForm) {
        addCouponForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleFormSubmit(addCouponForm, '/admin/add-coupons', 'POST', '/admin/coupons');
        });
    }

    // Edit Coupon Form Submission
    const editCouponForm = document.getElementById('edit-coupon-form');
    if (editCouponForm) {
        editCouponForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const couponId = new FormData(editCouponForm).get('id');
            handleFormSubmit(editCouponForm, `/admin/edit-coupons/${couponId}`, 'PUT', '/admin/coupons');
        });
    }

    // Utility function for toggling coupon status
    const toggleCouponStatus = async (button, action) => {
        try {
            const couponId = button.closest('form').id.split('-').pop();
            const response = await fetch(`/admin/${action}/${couponId}`, {
                method: 'POST',
                headers: {
                    'CSRF-Token': button.closest('form').querySelector('input[name="_csrf"]').value
                }
            });
            const result = await response.json();
            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: result.message
                }).then(() => {
                    window.location.reload();
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
                text: 'An error occurred while toggling the coupon status'
            });
        }
    }

    // Toggle Coupon Status
    const toggleCouponButtons = document.querySelectorAll('[id^=toggle-coupon-btn-]');
    toggleCouponButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            const action = this.getAttribute('data-active') === 'true' ? 'deactivate-coupon' : 'activate-coupon';
            toggleCouponStatus(this, action);
        });
    });
});