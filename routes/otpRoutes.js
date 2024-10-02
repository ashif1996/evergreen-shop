const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController'); // OTP controller
const { otpEmailValidationRules, otpValidationRules, resetPasswordValidationRules } = require('../middlewares/validators/userValidators'); // Validation rules
const validate = require('../middlewares/validate'); // Validation middleware

// Routes for OTP and password reset functionalities
router.post('/send-otp', otpEmailValidationRules, validate, otpController.handleSendOtp); // Send OTP to email
router.get('/verify-otp', otpController.getOtpVerification); // Get OTP verification page
router.post('/verify-otp', otpValidationRules, validate, otpController.handleVerifyOtp); // Verify OTP
router.get('/reset-password', otpController.getResetPassword); // Get reset password page
router.post('/reset-password', resetPasswordValidationRules, validate, otpController.handleResetPassword); // Reset password

module.exports = router; // Export the router