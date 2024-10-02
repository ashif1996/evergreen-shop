document.addEventListener('DOMContentLoaded', () => {
    // Selecting all buttons for adding products to the cart
    const addToCartButtons = document.querySelectorAll('.add-to-cart-form');
    const incrementButtons = document.querySelectorAll('.inc-btn');
    const decrementButtons = document.querySelectorAll('.dec-btn');
    const deleteCartItemButtons = document.querySelectorAll('.delete-cart-item');
    const checkoutButton = document.getElementById('checkout-btn');
    const csrfToken = document.querySelector('input[name="_csrf"]').value;

    if (addToCartButtons.length > 0) {
        addToCartButtons.forEach(form => {
            form.addEventListener('submit', async function(event) {
                event.preventDefault();
    
                const productId = this.querySelector('input[name="productId"]').value;
                const csrfToken = this.querySelector('input[name="_csrf"]').value;
    
                const isLoggedIn = document.querySelector('#userLinks').getAttribute('data-is-logged-in') === 'true';
    
                if (!isLoggedIn) {
                    try {
                        const result = await Swal.fire({
                            title: 'Login Required',
                            text: 'You need to be logged in to add items to the cart. Would you like to log in now?',
                            icon: 'info',
                            showCancelButton: true,
                            confirmButtonText: 'Login',
                            cancelButtonText: 'Cancel'
                        });
    
                        if (result.isConfirmed) {
                            window.location.href = '/users/login';
                        }
                    } catch (error) {
                        console.error("Error displaying SweetAlert:", error);
                    }
    
                    return;
                }
    
                try {
                    const response = await fetch('/users/shoppingCart/add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({ productId })
                    });
    
                    if (response.redirected) {
                        await Swal.fire({
                            title: 'Login Required',
                            text: 'You need to log in to add items to the cart.',
                            icon: 'warning'
                        });
                        window.location.href = response.url;
                        return;
                    }
    
                    const data = await response.json();
    
                    if (data.success) {
                        await Swal.fire({
                            title: 'Success!',
                            text: 'Product added to cart!',
                            icon: 'success'
                        });
                    } else {
                        await Swal.fire({
                            title: 'Warning',
                            text: data.message,
                            icon: 'warning'
                        });
                    }
                } catch (error) {
                    console.error("Error:", error);
                    await Swal.fire({
                        title: 'Error',
                        text: `An unexpected error occurred: ${error.message}`,
                        icon: 'error'
                    });
                }
            });
        });
    };

    const updateUI = (productId, itemTotal, subTotal, totalPrice) => {
        const itemTotalElement = document.querySelector(`p[data-product-id="${productId}"]`);
        const subTotalElement = document.querySelector('#cart-subtotal');
        const totalPriceElement = document.querySelector('#cart-total-price');

        if (itemTotalElement) {
            itemTotalElement.textContent = `Total: ₹${itemTotal}`;
        }
        
        if (subTotalElement) {
            subTotalElement.textContent = `Subtotal: ₹${subTotal}`;
        }

        if (totalPriceElement) {
            totalPriceElement.textContent = `Total: ₹${totalPrice}`;
        }
    };

    const validateQuantity = (newQuantity, stock, isIncrementing) => {
        const errorElement = document.getElementById('quantityError');
        let isValid = true;
        errorElement.textContent = '';
    
        if (newQuantity < 0.5) {
            errorElement.textContent = 'Quantity cannot be less than 0.5.';
            isValid = false;
        }
    
        // If the new quantity exceeds stock and we're incrementing
        if (isIncrementing && newQuantity > stock) {
            errorElement.textContent = `Quantity cannot exceed ${stock} (available stock).`;
            isValid = false;
        }
    
        return isValid;
    };

    const updateQuantity = async (productId, change, isIncrementing) => {
        const quantityInput = document.querySelector(`input[data-product-id="${productId}"]`);
        const category = quantityInput.getAttribute('data-category');
        const stock = parseFloat(quantityInput.getAttribute('data-stock'));
    
        if (quantityInput) {
            const currentQuantity = parseFloat(quantityInput.value);
            const newQuantity = currentQuantity + change;
    
            if (validateQuantity(newQuantity, stock, isIncrementing)) {
                quantityInput.value = newQuantity + (category === 'Juice and Drinks' ? ' L' : ' kg');
    
                try {
                    const response = await fetch('/users/shoppingCart/update-quantity', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({ productId, quantity: newQuantity })
                    });
    
                    const data = await response.json();
    
                    if (data.success) {
                        updateUI(productId, data.itemTotal, data.subTotal, data.totalPrice);
                    } else {
                        console.error('Failed to update cart:', data.message);
                    }
                } catch (err) {
                    console.error('Error updating cart:', err);
                }
            }
        }
    };

    const deleteCartItems = async (productId, csrfToken) => {
        try {
            const response = await fetch('/users/shoppingCart/delete-item', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ productId })
            });

            const data = await response.json();

            if (data.success) {
                updateUI(null, null, data.subTotal, data.totalPrice);
                location.reload();
            } else {
                console.error('Failed to delete cart item:', data.message);
            }
        } catch (err) {
            console.error('Error deleting cart item:', err);
        }
    };

    if (incrementButtons.length > 0 || decrementButtons.length > 0 || deleteCartItemButtons.length > 0) {
        incrementButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                const productId = this.getAttribute('data-product-id');
                updateQuantity(productId, 0.5, true);
            });
        });

        decrementButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                const productId = this.getAttribute('data-product-id');
                updateQuantity(productId, -0.5, false);
            });
        });

        deleteCartItemButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                const productId = this.getAttribute('data-product-id');
                deleteCartItems(productId, csrfToken);
            });
        });
    };

    if (checkoutButton) {
        checkoutButton.addEventListener('click', (event) => {
            event.preventDefault();
    
            // Access cart items length from the data attribute
            const cartItems = parseInt(checkoutButton.getAttribute('data-cart-items-length'), 10);
    
            if (cartItems > 0) {
                let stockExceeded = false; // Flag to track if stock is exceeded
                let exceedingItem = null; // To store the item with the issue
    
                // Select all quantity input fields
                const quantityInputs = document.querySelectorAll('.quantity-input');
    
                // Loop through each quantity input to check stock availability
                quantityInputs.forEach(input => {
                    const stock = parseInt(input.getAttribute('data-stock'), 10);
                    const quantity = parseInt(input.getAttribute('data-quantity'), 10);
                    const productId = input.getAttribute('data-product-id');
    
                    // Check if quantity exceeds stock
                    if (quantity > stock) {
                        stockExceeded = true;
                        exceedingItem = productId; // Store the product id of the item that exceeds stock
                    }
                });
    
                if (stockExceeded) {
                    // Show SweetAlert if any item's quantity exceeds stock
                    Swal.fire({
                        icon: 'warning',
                        title: 'Quantity Exceeded',
                        text: `One or more items have quantities exceeding available stock. Please adjust your cart.`,
                        confirmButtonText: 'OK'
                    });
                } else {
                    // Proceed to the checkout page if no stock issues
                    window.location.href = '/orders/checkout';
                }
            } else {
                // Show SweetAlert if the cart is empty
                Swal.fire({
                    icon: 'warning',
                    title: 'Your cart is empty!',
                    text: 'Please add items to your cart before proceeding to checkout.',
                    confirmButtonText: 'OK'
                });
            }
        });
    }
});