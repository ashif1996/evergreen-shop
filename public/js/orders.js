document.addEventListener('DOMContentLoaded', () => {
    const displayErrors = (field, message) => {
        const errorElement = document.getElementById(`${field}Error`);
        if (errorElement) {
            errorElement.textContent = message;
        }
    };

    const clearErrors = () => {
        document.querySelectorAll('.error-message').forEach((error) => {
            error.textContent = '';
        });
    };

    // Payment method handling
    const paymentMethodInputs = document.querySelectorAll('input[name="paymentMethod"]');
    const paymentMethodHiddenInput = document.getElementById('paymentMethod');

    // Terms and conditions handling
    const termsConditionsCheckbox = document.querySelector('input[name="termsConditions"]');
    const termsConditionsHiddenInput = document.getElementById('terms-conditions');

    // Function to update hidden input value based on selected radio button or checkbox
    const updateHiddenInput = (inputs, hiddenInput, isCheckbox = false) => {
        if (!hiddenInput) return; // Return if hidden input doesn't exist

        if (isCheckbox) {
            hiddenInput.value = inputs.checked ? inputs.value : '';
        } else {
            const selectedInput = Array.from(inputs).find(input => input.checked);
            hiddenInput.value = selectedInput ? selectedInput.value : '';
        }
    };

    // Update hidden inputs on page load if elements are present
    if (paymentMethodInputs.length > 0 && paymentMethodHiddenInput) {
        updateHiddenInput(paymentMethodInputs, paymentMethodHiddenInput); // For payment methods
        paymentMethodInputs.forEach(input => {
            input.addEventListener('change', () => updateHiddenInput(paymentMethodInputs, paymentMethodHiddenInput));
        });
    }

    if (termsConditionsCheckbox && termsConditionsHiddenInput) {
        updateHiddenInput(termsConditionsCheckbox, termsConditionsHiddenInput, true); // For terms and conditions (checkbox)
        termsConditionsCheckbox.addEventListener('change', () => updateHiddenInput(termsConditionsCheckbox, termsConditionsHiddenInput, true));
    }

    const validateCheckoutForm = () => {
        const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
        const selectedTermsConditions = document.querySelector('input[name="termsConditions"]:checked');
        const selectedAddress = document.querySelector('input[name="addressId"]:checked');

        let isValid = true;
        clearErrors();

        if (!selectedAddress) {
            displayErrors('address', 'Please select a shipping address.');
            isValid = false;
        }

        if (!selectedPaymentMethod) {
            displayErrors('paymentMethod', 'Please select a payment method.');
            isValid = false;
        }

        if (!selectedTermsConditions) {
            displayErrors('termsConditions', 'You must accept the terms and conditions.');
            isValid = false;
        }

        return isValid;
    };

    // Function to handle form submission
    const handleFormSubmit = async (form, endPoint) => {
        const csrfToken = document.querySelector('input[name="_csrf"]').value;
        const formData = new FormData(form);
        const jsonData = JSON.stringify(Object.fromEntries(formData.entries()));

        try {
            const response = await fetch(endPoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: jsonData
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'An error occurred'
                };
            }

            return data;
        } catch (error) {
            console.error("Error submitting form:", error);
            return {
                success: false,
                message: error.message || "An unexpected error occurred. Please try again later."
            };
        }
    };

    // Helper function to show success alert
    const showSuccessAlert = (title, text, redirectUrl) => {
        Swal.fire({
            title: title,
            text: text,
            icon: 'success',
            confirmButtonText: 'OK'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = redirectUrl;
            }
        });
    };

    // Helper function to show error alert
    const showErrorAlert = (title, text, redirectUrl) => {
        Swal.fire({
            title: title,
            text: text,
            icon: 'error',
            confirmButtonText: 'OK'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = redirectUrl;
            }
        });
    };

    // Function to handle Razorpay payment failure
    const handleRazorpayPaymentFailure = async (response) => {
        console.log('Handling Razorpay payment failure:', response);
        const razorpayOrderId = response.error.metadata.order_id;
        const csrfToken = document.querySelector('input[name="_csrf"]').value;

        if (!razorpayOrderId) {
            console.error('Razorpay order ID is missing');
            showErrorAlert(
                'Error',
                'Razorpay order ID is missing. Please contact support.',
                '/orders/my-orders'
            );
            return;
        }

        try {
            const failureResponse = await fetch('/orders/checkout/razorpay/payment/failed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    orderId: razorpayOrderId
                })
            });

            const failureData = await failureResponse.json();
            console.log('Payment failure response:', failureData);

            if (failureData.success) {
                showErrorAlert(
                    'Payment Failed',
                    'Your payment failed. Please try again or contact support if the issue persists.',
                    '/orders/my-orders'
                );
            } else {
                showErrorAlert(
                    'Error',
                    failureData.message || 'An error occurred while processing your payment failure.',
                    '/orders/my-orders'
                );
            }
        } catch (error) {
            console.error('Failed to handle payment failure:', error);
            showErrorAlert(
                'Error',
                'An unexpected error occurred. Please try again later.',
                '/orders/my-orders'
            );
        }
    };

    // Function to verify Razorpay payment
    const verifyRazorpayPayment = async (response) => {
        const csrfToken = document.querySelector('input[name="_csrf"]').value;
        const verifyResponse = await fetch('/orders/checkout/razorpay/verify/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
            })
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.success) {
            showSuccessAlert(
                'Payment Successful',
                'Your order has been placed successfully.',
                `/orders/order-summary/${verifyData.order._id}`
            );
        } else {
            showErrorAlert(
                'Payment Failed',
                'There was an issue with your payment. Please try again.',
                '/orders/my-orders'
            );
        }
    };

    // Function to handle Razorpay payment
    const handleRazorpayPayment = async () => {
        const orderForm = document.getElementById('order-form');
        const formResponse = await handleFormSubmit(orderForm, '/orders/checkout/create/order');

        if (formResponse && formResponse.success && formResponse.razorpayOrderId) {
            const options = {
                key: formResponse.razorpayKeyId,
                amount: formResponse.totalAmount * 100, // in paise
                currency: 'INR',
                name: 'EverGreen',
                description: 'Order Payment',
                order_id: formResponse.razorpayOrderId,
                handler: async (response) => {
                    try {
                        await verifyRazorpayPayment(response);
                    } catch (error) {
                        console.error('Payment verification failed:', error);
                        showErrorAlert(
                            'Payment Verification Failed',
                            'There was an error verifying your payment. Please contact support.',
                            '/orders/my-orders'
                        );
                    }
                },
                prefill: {
                    name: "Ashif Hassan",
                    email: "ashif123@gmail.com",
                    contact: "91896543332"
                },
                notes: {
                    address: formResponse.shippingAddress
                },
                theme: {
                    color: '#3399cc'
                },
                modal: {
                    ondismiss: function () {
                        console.log("Payment popup closed");
                        showErrorAlert(
                            'Payment Unsuccessful',
                            'Your payment was unsuccessful. Please try again from your order details page.',
                            '/orders/my-orders'
                        );
                    }
                }
            };

            const rzp = new Razorpay(options);
            rzp.on('payment.failed', async (response) => {
                await handleRazorpayPaymentFailure(response);
            });
            rzp.open();
        } else {
            showErrorAlert(
                'Order Creation Failed',
                formResponse.message || 'There was an error creating your order. Please try again.',
                '/orders/my-orders'
            );
        }
    };

    // Function to process the order
    const processOrder = async (orderForm, url) => {
        const formResponse = await handleFormSubmit(orderForm, url);

        if (formResponse && formResponse.success) {
            showSuccessAlert(
                'Order Successful!',
                formResponse.message,
                `/orders/order-summary/${formResponse.orderId}`
            );
        } else {
            showErrorAlert(
                'Error',
                formResponse ? formResponse.message : 'An error occurred. Please try again.',
                '/orders/my-orders'
            );
        }
    };

    // Form submission handling
    const orderForm = document.getElementById('order-form');
    const submitButton = document.getElementById('submit-button');

    if (submitButton && orderForm) {
        submitButton.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent default button behavior

            // First, perform validation
            if (!validateCheckoutForm()) {
                return; // Stop execution if validation fails
            }

            const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
            const paymentMethodValue = selectedPaymentMethod ? selectedPaymentMethod.value : null;

            // Show confirmation dialog
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to place the order?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                if (paymentMethodValue === 'Razorpay') {
                    // Handle Razorpay payment
                    await handleRazorpayPayment();
                } else if (paymentMethodValue === 'Wallet') {
                    // Handle Wallet payment
                    await processOrder(orderForm, '/orders/checkout/create/order');
                } else {
                    // Handle other payment methods
                    await processOrder(orderForm, '/orders/checkout/create/order');
                }
            } else {
                // If the user cancels
                Swal.fire({
                    icon: 'info',
                    title: 'Cancelled',
                    text: 'The order was not placed.',
                    background: "#fff3cd",
                    confirmButtonColor: "#ffc107",
                    confirmButtonText: "OK"
                });
            }
        });
    }

    // Order status change handling
    const orderStatusDropdowns = document.querySelectorAll('.form-select[data-order-id]');
    console.log(orderStatusDropdowns);

    if (orderStatusDropdowns.length > 0) {
        orderStatusDropdowns.forEach(dropdown => {
            dropdown.addEventListener('change', function () {
                const orderId = this.getAttribute('data-order-id');
                const form = document.getElementById(`order-status-form-${orderId}`);
                const selectedValue = this.value;
                const previousValue = this.getAttribute('data-current');

                Swal.fire({
                    title: 'Are you sure?',
                    text: `Do you really want to change the order status to ${selectedValue}?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        const formResponse = await handleFormSubmit(form, `/admin/orders/update-order-status/${orderId}`);
                        
                        if (formResponse && formResponse.success) {
                            Swal.fire({
                                icon: "success",
                                title: "Success!",
                                text: formResponse.message,
                                background: "#d4edda",
                                confirmButtonColor: "#28a745",
                                confirmButtonText: "Ok"
                            }).then(() => {
                                this.setAttribute('data-current', selectedValue); // Update the current value after successful change
                                window.location.reload();
                            });
                        } else {
                            this.value = previousValue; // Revert to previous value if submission fails
                        }
                    } else {
                        this.value = previousValue; // Revert to previous value if canceled
                    }
                });
            });
        });
    }

    const statusForms = document.querySelectorAll('.item-status-form');

    if (statusForms) {
        statusForms.forEach(form => {
            const submitButton = form.querySelector('button[type="submit"]');

            if (submitButton) {
                submitButton.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation(); // Prevent default and stop propagation
                    
                    const orderId = form.dataset.orderId;
                    const itemId = form.dataset.itemId;
                    const itemStatus = form.querySelector('select[name="itemStatus"]').value;
                    const csrfToken = document.querySelector('input[name="_csrf"]').value;

                    // Show confirmation SweetAlert
                    Swal.fire({
                        title: 'Are you sure?',
                        text: `You are about to change the item status to ${itemStatus}.`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Yes'
                    }).then(async (result) => {
                        if (result.isConfirmed) {
                            // Proceed with the fetch request after confirmation
                            try {
                                const response = await fetch(`/admin/orders/${orderId}/item/${itemId}/status/update`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'CSRF-Token': csrfToken
                                    },
                                    body: JSON.stringify({ itemStatus }),
                                });

                                const data = await response.json();

                                if (data.success) {
                                    Swal.fire({
                                        icon: 'success',
                                        title: 'Success',
                                        text: data.message,
                                    }).then(() => {
                                        window.location.reload();
                                    });
                                } else {
                                    Swal.fire({
                                        icon: 'error',
                                        title: 'Error',
                                        text: data.message,
                                    });
                                }
                            } catch (error) {
                                console.error("Error updating item status:", error);
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error',
                                    text: 'An unexpected error occurred. Please try again later.',
                                });
                            }
                        }
                    });
                });
            }
        });
    }
});