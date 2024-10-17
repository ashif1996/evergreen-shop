const User = require("../models/user");
const {
  generateOtp,
  storeOtp,
  sendOtp,
  verifyOtp,
  cleanupExpiredOtps,
} = require("../utils/otpUtils");
const errorHandler = require("../utils/errorHandlerUtils");
const successHandler = require("../utils/successHandlerUtils");
const HttpStatus = require("../utils/httpStatus");

// Handle sending OTP to the user's email
const handleSendOtp = async (req, res) => {
  const { email, redirectUrl } = req.body;

  try {
    await cleanupExpiredOtps();
    const otp = generateOtp();
    console.log(otp);
    await storeOtp(email, otp);
    await sendOtp(email, otp);
    req.session.otpSend = true;
    req.session.email = email;

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "OTP sent successfully.",
      redirectUrl,
      otpSend: true,
    });
  } catch (err) {
    console.log("An error occurred when handling OTP: ", err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error sending OTP!",
      originalUrl: req.originalUrl,
      otpSend: false,
    });
  }
};

// Render OTP verification page
const getOtpVerification = (req, res) => {
  const locals = { title: "Verify OTP | EverGreen" };
  const email = req.session.email;
  const otpSend = req.session.otpSend;
  console.log(otpSend);

  return res.render("users/otp-verification", {
    locals,
    layout: "layouts/authLayout",
    email,
    otpSend,
  });
};

// Verify the user's OTP
const handleVerifyOtp = async (req, res) => {
  const { otp, redirectUrl } = req.body;
  const email = req.session.email;

  try {
    const result = await verifyOtp(email, otp);
    if (result.isVerified) {
      req.session.otpSend = false;

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "OTP verified successfully.",
        redirectUrl,
      });
    } else {
      const message = result.reason === "expired" ? "The OTP has expired." : "The OTP is invalid.";
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message });
    }
  } catch (err) {
    console.error("Error verifying OTP: ", err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred while verifying OTP.",
      redirectUrl,
    });
  }
};

// Render reset password page
const getResetPassword = (req, res) => {
  const locals = { title: "Reset Password | EverGreen" };
  const email = req.session.email;

  return res.render("users/reset-password", {
    locals,
    layout: "layouts/authLayout",
    email,
  });
};

// Handle password reset logic
const handleResetPassword = async (req, res, next) => {
  const { newPassword, confirmPassword } = req.body;
  const email = req.session.email;

  if (newPassword !== confirmPassword) {
    return errorHandler(res, HttpStatus.BAD_REQUEST, "Passwords do not match.");
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
    }

    user.password = newPassword;
    await user.save();

    return successHandler(res, HttpStatus.OK, "Password changed successfully.");
  } catch (err) {
    console.error("Error resetting the password: ", err);
    return next(err);
  }
};

// Periodically clean up expired OTPs
setInterval(cleanupExpiredOtps, 60 * 60 * 1000);

module.exports = {
  handleSendOtp,
  getOtpVerification,
  handleVerifyOtp,
  getResetPassword,
  handleResetPassword,
};