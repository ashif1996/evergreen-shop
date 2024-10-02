document.addEventListener('DOMContentLoaded', () => {
    const couponForm = document.getElementById('coupon-form');
    const removeCoupon = document.getElementById('remove-coupon-form');
    const csrfToken = document.querySelector('input[name="_csrf"]').value;

    // Apply coupon logic (unchanged)
    if (couponForm) {
        couponForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const couponCode = couponForm.querySelector('input[name="couponCode"]').value;

            try {
                const response = await fetch('/orders/checkout/apply-coupon', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ couponCode })
                });

                const data = await response.json();

                if (data.success) {
                    await Swal.fire({
                        title: 'Success!',
                        text: `Coupon ${data.couponName} applied successfully.`,
                        icon: 'success'
                    });

                    const discountElement = document.querySelector('#cart-coupon-discount');
                    const subTotalElement = document.querySelector('#cart-subtotal');
                    const totalPriceElement = document.querySelector('#cart-total-price');

                    if (discountElement) {
                        discountElement.textContent = `- ₹${data.couponDiscount}`;
                    }

                    if (subTotalElement) {
                        subTotalElement.textContent = `Subtotal: ₹${data.subtotal}`;
                    }

                    if (totalPriceElement) {
                        totalPriceElement.textContent = `Total: ₹${data.totalPrice}`;
                    }

                    location.reload();
                } else {
                    await Swal.fire({
                        title: 'Error',
                        text: data.message,
                        icon: 'error'
                    });
                }
            } catch (error) {
                console.error('Error applying coupon:', error);

                Swal.fire({
                    title: 'Error',
                    text: 'An internal error occurred.',
                    icon: 'error'
                });
            }
        });
    }

    if (removeCoupon) {
        removeCoupon.addEventListener('submit', async function (e) {
            e.preventDefault();

            try {
                const response = await fetch('/orders/checkout/remove-coupon', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    }
                });

                const data = await response.json();

                if (data.success) {
                    // Show SweetAlert notification for successful removal
                    await Swal.fire({
                        title: 'Success!',
                        text: 'Coupon removed successfully.',
                        icon: 'success',
                        confirmButtonText: 'OK'
                    });

                    // Update the page to reflect the removed coupon
                    const discountElement = document.getElementById('cart-coupon-discount');
                    const totalPriceElement = document.getElementById('cart-total-price');

                    if (discountElement) {
                        discountElement.textContent = ''; // Clear the coupon discount
                    }

                    if (totalPriceElement) {
                        totalPriceElement.textContent = `₹${data.totalPrice}`; // Update total price
                    }

                    location.reload(); // Optionally reload the page to refresh the order summary
                } else {
                    // Handle any errors if coupon removal failed
                    Swal.fire({
                        title: 'Error',
                        text: data.message || 'Failed to remove the coupon.',
                        icon: 'error',
                        confirmButtonText: 'OK'
                    });
                }
            } catch (error) {
                console.error('Error removing coupon:', error);

                // Optionally show an error alert
                Swal.fire({
                    title: 'Error!',
                    text: 'An error occurred while removing the coupon.',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
        });
    }
});