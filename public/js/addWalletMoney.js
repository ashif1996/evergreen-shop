document.getElementById('addMoneyForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
        const amount = document.querySelector('input[name="amount"]').value;
        const note = document.querySelector('input[name="note"]').value;
        const csrfToken = document.querySelector('input[name="_csrf"]').value;

        // Send a request to create a payment order
        const orderResponse = await fetch('/users/wallet/money/add/initiate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({ amount, note })
        });

        const order = await orderResponse.json();

        if (order.id) {
            let options = {
                key: order.key_id, // Razorpay key_id sent from the server
                amount: order.amount,
                currency: order.currency,
                name: 'EverGreen',
                description: 'Wallet Top-up',
                order_id: order.id,
                "handler": async (response) => {
                    try {
                        const paymentVerificationResponse = await fetch('/users/wallet/money/add/verify', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'CSRF-Token': csrfToken
                            },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                                amount: order.amount,
                                note: order.notes.description
                            })
                        });

                        const data = await paymentVerificationResponse.json();

                        if (data.success) {
                            Swal.fire(
                                'Payment Successful!',
                                `Your wallet has been credited with Rs.${amount}.`,
                                'success'
                            ).then(() => {
                                window.location.href = '/users/wallet';
                            });
                        } else {
                            Swal.fire(
                                'Payment Failed',
                                'Verification failed, please try again.',
                                'error'
                            );
                        }
                    } catch (error) {
                        console.error('Payment verification error:', error);
                        Swal.fire(
                            'Error',
                            'Something went wrong during payment verification. Please try again.',
                            'error'
                        );
                    }
                },
                prefill: {
                    "name": "Your Name",
                    "email": "your.email@example.com"
                }
            };

            var rzp1 = new Razorpay(options);
            rzp1.open();
        } else {
            Swal.fire(
                'Error',
                'Failed to create payment order. Please try again.',
                'error'
            );
        }
    } catch (error) {
        console.error('Order creation error:', error);
        Swal.fire(
            'Error',
            'Something went wrong. Please try again.',
            'error'
        );
    }
});