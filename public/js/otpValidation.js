document.addEventListener('DOMContentLoaded', () => {
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const otpInput = document.getElementById('otp');
    const otpError = document.getElementById('otpError');
    const otpSection = document.getElementById('otpSection');
    const signupBtn = document.getElementById('signupBtn');
    const signupResendOtpLink = document.getElementById('signupResendOtpLink');
    const resendOtpLink = document.getElementById('resendOtpLink');
    const resetPasswordForm = document.getElementById('resetPassword');
    const spinner = document.getElementById('loader');
    let otpTimer;

    // Function to show the loader
    const showLoader = () => {
        spinner.style.display = 'flex';  // Show the loader
    };

    // Function to hide the loader
    const hideLoader = () => {
        spinner.style.display = 'none';  // Hide the loader
    };

    const startOtpTimer = () => {
        let time = 60;
        otpTimer = setInterval(() => {
            if (time <= 0) {
                clearInterval(otpTimer);
                document.querySelector('.timer').innerText = '00:00';
                otpError.textContent = 'OTP expired, please request a new one';
                otpError.style.color = 'red';
                if (signupBtn) {
                    signupBtn.disabled = true;
                }
            } else {
                const minutes = Math.floor(time / 60);
                const seconds = time % 60;
                document.querySelector('.timer').innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

                if (time < 10) {
                    document.querySelector('.timer').style.color = 'red'; // Change color when less than 10 seconds
                } else {
                    document.querySelector('.timer').style.color = 'black'; // Reset color for other times
                }

                time--;
            }
        }, 1000);
    };

    const clearOtpTimer = () => {
        clearInterval(otpTimer);
        document.querySelector('.timer').innerText = '00:00';
    };

    const handleSendOtpResponse = (data, redirectUrl) => {
        hideLoader();
        if (data.success) {
            Swal.fire({
                icon: 'success', // You can change the icon depending on your message type
                title: 'OTP Sent!',
                text: 'An OTP has been sent to your email. Please check your email.',
                confirmButtonText: 'OK',
                allowOutsideClick: false, // Prevent closing the alert by clicking outside
            }).then((result) => {
                if (result.isConfirmed) {
                    if (redirectUrl === '/users/signup') {
                        otpSection.style.display = 'block';
                        otpError.textContent = '';
                        otpError.classList.remove('error-message');
                        if (data.otpSend) {
                            startOtpTimer();
                        }
                    } else {
                        window.location.href = redirectUrl;
                        if (data.otpSend) {
                            startOtpTimer();
                        }
                    }
                }
            });         
        } else {
            emailError.textContent = 'Error sending OTP';
            emailError.classList.add('error-message');
        }
    };

    const handleVerifyOtpResponse = (data, redirectUrl) => {
        if (data.success) {
            Swal.fire({
                icon: 'success', 
                title: 'OTP Verified!',
                text: 'Proceed with the signup.',
                confirmButtonText: 'OK',
                allowOutsideClick: false,
            }).then((result) => {
                // The actions below happen after the user clicks "OK" on the SweetAlert
                if (result.isConfirmed) {
                    otpError.textContent = '';
                    
                    if (redirectUrl === '/users/signup') {
                        // Actions for the signup page
                        otpError.textContent = 'OTP verified successfully';
                        otpError.classList.add('success-message');
                        otpError.classList.remove('error-message');
                        
                        if (signupBtn) {
                            signupBtn.disabled = false;  // Enable the signup button
                            clearOtpTimer();
                        }
                    } else {
                        // Actions for password reset or other flows
                        otpError.textContent = 'OTP verified successfully';
                        otpError.classList.add('success-message');
                        clearOtpTimer();
                        // Redirect after "OK" is clicked
                        window.location.href = redirectUrl;
                    }
                }
            });
    
        } else {
            // Handle OTP verification failure
            if (data.errors) {
                otpError.textContent = data.errors[0];
            } else if (data.message === 'The OTP has expired.') {
                otpError.textContent = 'The OTP has expired. Please request a new one.';
            } else if (data.message === 'The OTP is invalid.') {
                otpError.textContent = 'The OTP is invalid. Please check and try again.';
            } else {
                otpError.textContent = 'An unexpected error occurred. Please try again.';
            }
            otpError.classList.add('error-message');
            otpError.classList.remove('success-message');
        }
    };    

    if (sendOtpBtn && emailInput) {
        sendOtpBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            const email = emailInput.value.trim();
            const redirectUrl = document.querySelector('input[name="redirectUrl"]').value;

            if (!email) {
                emailError.textContent = 'Please provide your email to send OTP';
                emailError.classList.add('error-message');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                emailError.textContent = 'Please provide a valid email to send OTP';
                emailError.classList.add('error-message');
                return;
            }

            emailError.textContent = '';
            emailError.classList.remove('error-message');

            showLoader();

            const response = await fetch('/otp/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': document.querySelector('input[name="_csrf"]').value
                },
                body: JSON.stringify({ email, redirectUrl })
            });

            const data = await response.json();

            handleSendOtpResponse(data, redirectUrl);
        });
    };

    if (verifyOtpBtn && otpInput) {
        const redirectUrl = document.querySelector('input[name="redirectUrl"]').value;
        const otpSend = document.querySelector(`input[name="otpSend"]`) ? document.querySelector(`input[name="otpSend"]`).value : '';
        console.log('otpSend:', otpSend);
        if (redirectUrl === '/otp/reset-password' && otpSend) {
            startOtpTimer();
        }

        verifyOtpBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            const otp = otpInput.value;

            if (!otp) {
                otpError.textContent = 'Please enter the OTP';
                otpError.classList.add('error-message');
                return;
            }

            otpError.textContent = '';
            otpError.classList.remove('error-message');

            let bodyData;
            if (emailInput) {
                const email = emailInput.value.trim();
                bodyData = { email, otp, redirectUrl };
            } else {
                bodyData = { otp, redirectUrl };
            }

            const response = await fetch('/otp/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': document.querySelector('input[name="_csrf"]').value
                },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();
            handleVerifyOtpResponse(data, redirectUrl);
        });
    };

    if (signupResendOtpLink && sendOtpBtn) {
        signupResendOtpLink.addEventListener('click', (event) => {
            event.preventDefault();
            sendOtpBtn.click();
        });
    };

    if (resendOtpLink) {
        resendOtpLink.addEventListener('click', async (event) => {
            event.preventDefault();
            const redirectUrl = window.location.href;
            const email = document.querySelector('input[name="email"]').value;

            showLoader();

            try {
                const response = await fetch('/otp/send-otp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': document.querySelector('input[name="_csrf"]').value
                    },
                    body: JSON.stringify({ email, redirectUrl })
                });
    
                const data = await response.json();
    
                // Handle the response and hide the loader when the response is received
                handleSendOtpResponse(data, redirectUrl);
            } catch (error) {
                console.error('Error sending OTP:', error);
                emailError.textContent = 'Error resending OTP';
                emailError.classList.add('error-message');
                hideLoader();  // Hide the loader if an error occurs
            }
        });
    };

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const newPassword = document.getElementById('newPassword').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();
            const resetPasswordError = document.getElementById('resetPasswordError');
            const email = document.querySelector('input[name="email"]').value;
            const csrfToken = document.querySelector('input[name="_csrf"]').value; // CSRF token
            const redirectUrl = document.querySelector('input[name="redirectUrl"]').value;

            // Clear any previous error messages
            resetPasswordError.textContent = '';
            resetPasswordError.classList.remove('error-message');

            // Client-side validation
            if (newPassword === '' || confirmPassword === '') {
                resetPasswordError.textContent = 'Please fill out both password fields.';
                resetPasswordError.classList.add('error-message');
            } else if (newPassword.length < 8) {
                resetPasswordError.textContent = 'Password must be at least 8 characters long.';
                resetPasswordError.classList.add('error-message');
            } else if (confirmPassword.length < 8) {
                resetPasswordError.textContent = 'Confirm password must be at least 8 characters long.';
                resetPasswordError.classList.add('error-message');
            } else if (newPassword !== confirmPassword) {
                resetPasswordError.textContent = 'Passwords do not match. Please try again.';
                resetPasswordError.classList.add('error-message');
            } else {
                // If validation passes, prepare the data to send to the server
                const requestData = {
                    email,
                    newPassword,
                    confirmPassword,
                    redirectUrl,
                };

                try {
                    // Send the request to the server
                    const response = await fetch('/otp/reset-password', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(requestData),
                    });

                    const data = await response.json();

                    // Handle success
                    if (data.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Password Changed!',
                            text: data.message,
                            confirmButtonText: 'OK',
                            allowOutsideClick: false,
                        }).then((result) => {
                            if (result.isConfirmed) {
                                window.location.href = redirectUrl; // Redirect to login page after success
                            }
                        });
                    } else {
                        // Handle failure
                        Swal.fire({
                            icon: 'error',
                            title: 'Password Reset Failed',
                            text: data.message,
                            confirmButtonText: 'OK',
                            allowOutsideClick: false,
                        }).then((result) => {
                            if (result.isConfirmed) {
                                window.location.href = '/otp/reset-password'; // Redirect back to the reset page after failure
                            }
                        });
                    }
                } catch (error) {
                    console.error('Error:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error!',
                        text: 'An unexpected error occurred. Please try again.',
                        confirmButtonText: 'OK',
                        allowOutsideClick: false,
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.location.href = '/otp/reset-password'; // Redirect back to reset page on error
                        }
                    });
                }
            }
        });
    }    
});