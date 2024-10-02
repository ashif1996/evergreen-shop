document.addEventListener('DOMContentLoaded', function() {
    const showConfirmationBox = ({ title,text, confirmButtonText, onConfirm }) => {
        Swal.fire({
            icon: 'warning',
            title: title,
            text: text,
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: confirmButtonText
        }).then(result => {
            if (result.isConfirmed) {
                onConfirm();
            }
        });
    }

    
    // Handle user blocking
    const blockUserButtons = document.querySelectorAll('[id^="block-user-btn-"]');
    if (blockUserButtons.length > 0) {
        blockUserButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                const userId = this.id.split('-').pop(); // Extract user ID
                const form = document.getElementById(`block-form-${userId}`);
                const userName = this.dataset.userName;
                const status = this.dataset.status;

                const confirmButtonText = status === 'true' ? 'block' : 'unblock';

                showConfirmationBox({
                    title: 'Are you sure?',
                    text: `Do you really want to ${confirmButtonText} ${userName}?`,
                    confirmButtonText: `Yes`,
                    onConfirm: () => form.submit()
                });
            });
        });
    };

    

    const unlistProductButtons = document.querySelectorAll('[id^="unlist-product-btn-"]');
    if (unlistProductButtons.length > 0) {
        unlistProductButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                const productId = this.id.split('-').pop(); // Extract product ID
                const form = document.getElementById(`toggle-product-form-${productId}`);
                const name = this.dataset.name;
                const isAvailable = this.dataset.availability === 'true';

                const confirmButtonText = isAvailable ? 'unlist' : 'list';

                showConfirmationBox({
                    title: 'Are you sure?',
                    text: `Do you really want to ${confirmButtonText} ${name}?`,
                    confirmButtonText: `Yes`,
                    onConfirm: () => form.submit()
                });
            });
        });
    }
});