const express = require('express');
const router = express.Router();

const otpController = require('../controllers/otpController');

const { otpEmailValidationRules, otpValidationRules, resetPasswordValidationRules } = require('../middlewares/validators/userValidators');
const validate = require('../middlewares/validate');

// Routes for OTP and password reset functionalities
router.post('/send-otp', otpEmailValidationRules, validate, otpController.handleSendOtp);

router.route("verify-otp")
    .get(otpController.getOtpVerification)
    .post(otpValidationRules, validate, otpController.handleVerifyOtp);
    
router.route("/reset-password")
    .get(otpController.getResetPassword)
    .post(resetPasswordValidationRules, validate, otpController.handleResetPassword);

module.exports = router;