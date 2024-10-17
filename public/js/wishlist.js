document.addEventListener('DOMContentLoaded', () => {
    const addTowishlistIcons = document.querySelectorAll('#wishlist-form');
    const deleteWishlistItemBtns = document.querySelectorAll('#delete-wishlist-item-form');
    const csrfToken = document.querySelector('input[name="_csrf"]').value;

    if (addTowishlistIcons.length > 0) {
        addTowishlistIcons.forEach(form => {
            form.addEventListener('submit', async function (event) {
                event.preventDefault();

                const productId = this.querySelector('input[name="productId"]').value;
                const isLoggedIn = document.querySelector('#userLinks').getAttribute('data-is-logged-in') === 'true';

                if (!isLoggedIn) {
                    try {
                        const result = await Swal.fire({
                            title: 'Login Required',
                            text: 'You need to be logged in to add items to the wishlist. Would you like to log in now?',
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
                    const response = await fetch('/users/wishlist/add', {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/json',
                            'CSRF-Token': csrfToken,
                        },
                        body: JSON.stringify({ productId })
                    });

                    if (response.redirected) {
                        await Swal.fire({
                            title: 'Login Required',
                            text: 'You need to log in to add items to the wishlist.',
                            icon: 'warning'
                        });
                        window.location.href = response.url;
                        return;
                    }

                    const data = await response.json();

                    if (data.success) {
                        await Swal.fire({
                            title: 'Success!',
                            text: data.message,
                            icon: 'success'
                        }).then(() => {
                            location.reload(); // Reloads the page when the user clicks OK
                        });
                    } else {
                        await Swal.fire({
                            title: 'Error',
                            text: data.message,
                            icon: 'error'
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
    }

    if (deleteWishlistItemBtns.length > 0) {
        deleteWishlistItemBtns.forEach(form => {
            form.addEventListener('submit', async function (event) {
                event.preventDefault();

                const productId = this.querySelector('input[name="productId"]').value;
                const isLoggedIn = document.querySelector('#userLinks').getAttribute('data-is-logged-in') === 'true';

                if (!isLoggedIn) {
                    try {
                        const result = await Swal.fire({
                            title: 'Login Required',
                            text: 'You need to be logged in to delete items from the wishlist. Would you like to log in now?',
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
                } else {
                    try {
                        const result = await Swal.fire({
                            icon: 'warning',
                            title: 'Are you sure?',
                            text: 'Do you really want to delete this item from your wishlist?',
                            showCancelButton: true,
                            confirmButtonColor: '#3085d6',
                            cancelButtonColor: '#d33',
                            confirmButtonText: 'Yes',
                            cancelButtonText: 'Cancel'
                        });

                        if (result.isConfirmed) {
                            try {
                                const response = await fetch(`/users/wishlist/delete/${productId}`, {
                                    method: 'POST',
                                    headers: {
                                        'content-type': 'application/json',
                                        'CSRF-Token': csrfToken
                                    },
                                    body: JSON.stringify({ productId })
                                });
            
                                if (response.redirected) {
                                    await Swal.fire({
                                        title: 'Login Required',
                                        text: 'You need to log in to delete items from the wishlist.',
                                        icon: 'warning'
                                    });
                                    window.location.href = response.url;
                                    return;
                                }
            
                                const data = await response.json();
            
                                if (data.success) {
                                    await Swal.fire({
                                        title: 'Success!',
                                        text: data.message,
                                        icon: 'success'
                                    }).then(() => {
                                        window.location.reload();
                                    });
                                } else {
                                    await Swal.fire({
                                        title: 'Error',
                                        text: data.message,
                                        icon: 'error'
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
                        }
                    } catch (error) {
                        console.error("An unexpected error occurred: ", error);
                    }
                }
            });
        });
    }
});