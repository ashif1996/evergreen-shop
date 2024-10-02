document.addEventListener('DOMContentLoaded', () => {
    const couponForm = document.getElementById('coupon-form');
    const csrfToken = document.querySelector('input[name="_csrf"]').value;

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
});