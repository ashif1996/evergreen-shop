document.addEventListener('DOMContentLoaded', () => {
    const validateSignupForm = () => {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        const firstNameError = document.getElementById('firstNameError');
        const lastNameError = document.getElementById('lastNameError');
        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');
        const confirmPasswordError = document.getElementById('confirmPasswordError');

        let isValid = true;

        firstNameError.textContent = '';
        firstNameError.classList.remove('error-message');
        lastNameError.textContent = '';
        lastNameError.classList.remove('error-message');
        emailError.textContent = '';
        emailError.classList.remove('error-message');
        passwordError.textContent = '';
        passwordError.classList.remove('error-message');
        confirmPasswordError.textContent = '';
        confirmPasswordError.classList.remove('error-message');

        if (firstName === '') {
            isValid = false;
            firstNameError.textContent = 'First name is required.';
            firstNameError.classList.add('error-message');
        } else if (firstName.length < 3 || firstName.length > 15) {
            isValid = false;
            firstNameError.textContent = 'First name must be between 3 and 15 characters long.';
            firstNameError.classList.add('error-message');
        } else if (!/^[a-zA-Z]+$/.test(firstName)) {
            isValid = false;
            firstNameError.textContent = 'Please enter a valid first name. Only letters are allowed.';
            firstNameError.classList.add('error-message');
        }

        if (lastName === '') {
            isValid = false;
            lastNameError.textContent = 'Last name is required.';
            lastNameError.classList.add('error-message');
        } else if (lastName.length < 3 || lastName.length > 15) {
            isValid = false;
            lastNameError.textContent = 'Last name must be between 3 and 15 characters long.';
            lastNameError.classList.add('error-message');
        } else if (!/^[a-zA-Z]+$/.test(lastName)) {
            isValid = false;
            lastNameError.textContent = 'Please enter a valid last name. Only letters are allowed.';
            lastNameError.classList.add('error-message');
        }

        if (email === '') {
            isValid = false;
            emailError.textContent = 'Email is required.';
            emailError.classList.add('error-message');
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            isValid = false;
            emailError.textContent = 'Please enter a valid email address.';
            emailError.classList.add('error-message');
        }

        if (password === '') {
            isValid = false;
            passwordError.textContent = 'Password is required.';
            passwordError.classList.add('error-message');
        } else if (password.length < 8) {
            isValid = false;
            passwordError.textContent = 'Password must be at least 8 characters long.';
            passwordError.classList.add('error-message');
        }

        if (confirmPassword === '') {
            isValid = false;
            confirmPasswordError.textContent = 'Please confirm your password.';
            confirmPasswordError.classList.add('error-message');
        } else if (confirmPassword.length < 8) {
            isValid = false;
            confirmPasswordError.textContent = 'Password must be at least 8 characters long.';
            confirmPasswordError.classList.add('error-message');
        } else if (password !== confirmPassword) {
            isValid = false;
            confirmPasswordError.textContent = 'Passwords do not match.';
            confirmPasswordError.classList.add('error-message');
        }

        return isValid;
    }

    const validateLoginForm = () => {
        const loginEmail = document.getElementById('loginEmail').value.trim();
        const loginPassword = document.getElementById('loginPassword').value;

        const emailError = document.getElementById('loginEmailError');
        const passwordError = document.getElementById('loginPasswordError');

        let isValid = true;

        emailError.textContent = '';
        emailError.classList.remove('error-message');
        passwordError.textContent = '';
        passwordError.classList.remove('error-message');

        if (loginEmail === '') {
            isValid = false;
            emailError.textContent = 'Email is required.';
            emailError.classList.add('error-message');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
            isValid = false;
            emailError.textContent = 'Please enter a valid email address.';
            emailError.classList.add('error-message');
        }

        if (loginPassword === '') {
            isValid = false;
            passwordError.textContent = 'Password is required.';
            passwordError.classList.add('error-message');
        } else if (loginPassword.length < 8) {
            isValid = false;
            passwordError.textContent = 'Password must be atleast 8 characters long.';
            passwordError.classList.add('error-message');
        }

        return isValid;
    }

    const csrfToken = document.querySelector('input[name="_csrf"]').value;

    const validateReferralCode = async () => {
        const referralCode = document.getElementById('referralCode').value.trim();
        const referralError = document.getElementById('referralCodeError');

        referralError.textContent = '';
        referralError.classList.remove('error-message');

        try {
            const response = await fetch('/users/referrals/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ referralCode }),
            });

            const data = await response.json();

            if (data.success) {
                referralError.textContent = data.message;
                referralError.classList.add('success-message');
                Swal.fire({
                    icon: 'success',
                    title: 'Referral Verified!',
                    text: data.message,
                    confirmButtonText: 'Continue',
                });
                return true;
            } else {
                referralError.textContent = data.message || 'Invalid referral code.';
                referralError.classList.add('error-message');
                return false;
            }
        } catch (error) {
            referralError.textContent = 'Error validating referral code.';
            referralError.classList.add('error-message');
            return false;
        }
    }

    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const referralCodeBtn = document.getElementById('referralCodeBtn');

    if (referralCodeBtn) {
        referralCodeBtn.addEventListener('click', async () => {
            await validateReferralCode();
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const isValidSignup = validateSignupForm();
            if (isValidSignup) {
                const formData = new FormData(signupForm);
                const csrfToken = document.querySelector('input[name="_csrf"]').value;

                try {
                    const response = await fetch(signupForm.action, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(Object.fromEntries(formData)),
                    });

                    const result = await response.json();

                    if (result.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Registration Successful!',
                            text: result.message,
                            confirmButtonText: 'OK'
                        }).then(() => {
                            window.location.href = '/users/login'; // Redirect to login page
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Registration Failed',
                            text: result.message,
                            confirmButtonText: 'OK'
                        });
                    }
                } catch (error) {
                    console.error('Error during signup:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'An error occurred during registration.',
                        confirmButtonText: 'OK'
                    });
                }
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const isValidLogin = validateLoginForm();
            if (isValidLogin) {
                loginForm.submit();
            }
        });
    }
});