const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');
const { otpEmailValidationRules, otpValidationRules, resetPasswordValidationRules } = require('../middlewares/validators/userValidators');
const validate = require('../middlewares/validate');

// Routes for OTP and password reset functionalities
router.post('/send-otp', otpEmailValidationRules, validate, otpController.handleSendOtp);
router.get('/verify-otp', otpController.getOtpVerification);
router.post('/verify-otp', otpValidationRules, validate, otpController.handleVerifyOtp);
router.get('/reset-password', otpController.getResetPassword);
router.post('/reset-password', resetPasswordValidationRules, validate, otpController.handleResetPassword);

module.exports = router;