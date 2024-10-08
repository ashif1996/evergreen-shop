const User = require("../models/user");
const {
  generateOtp,
  storeOtp,
  sendOtp,
  verifyOtp,
  cleanupExpiredOtps,
} = require("../utils/otpUtils");

// Handle sending OTP to the user's email
const handleSendOtp = async (req, res) => {
  const { email, redirectUrl } = req.body;

  try {
    await cleanupExpiredOtps(); // Clean up expired OTPs
    const otp = generateOtp(); // Generate a new OTP
    console.log(otp); // Log the generated OTP for debugging
    await storeOtp(email, otp); // Store the OTP in the database
    await sendOtp(email, otp); // Send the OTP to the user's email
    req.session.otpSend = true; // Set session flag indicating OTP has been sent
    req.session.email = email; // Store email in session

    // Respond with success message
    res.json({
      success: true,
      message: "OTP sent successfully.",
      redirectUrl,
      otpSend: true,
    });
  } catch (error) {
    console.log(error);
    // Respond with failure message
    res.json({
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

  // Render the OTP verification page
  res.render("users/otp-verification", {
    locals,
    layout: "layouts/authLayout",
    email,
    otpSend,
    csrfToken: req.csrfToken(),
  });
};

// Verify the user's OTP
const handleVerifyOtp = async (req, res) => {
  const { otp, redirectUrl } = req.body;
  const email = req.session.email;

  try {
    const result = await verifyOtp(email, otp); // Verify the OTP

    if (result.isVerified) {
      req.session.otpSend = false; // Mark OTP as used
      res
        .status(200)
        .json({
          success: true,
          message: "OTP verified successfully",
          redirectUrl,
        });
    } else {
      // Handle OTP verification failure
      const message =
        result.reason === "expired"
          ? "The OTP has expired."
          : "The OTP is invalid.";
      res.status(400).json({ success: false, message });
    }
  } catch (err) {
    console.error("Error verifying OTP:", err); // Log errors
    res
      .status(500)
      .json({
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
  res.render("users/reset-password", {
    locals,
    layout: "layouts/authLayout",
    email,
    csrfToken: req.csrfToken(),
  });
};

// Handle password reset logic
const handleResetPassword = async (req, res) => {
  const { newPassword, confirmPassword, redirectUrl } = req.body;
  const email = req.session.email;

  // Check if passwords match
  if (newPassword !== confirmPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Passwords do not match." });
  }

  try {
    const user = await User.findOne({ email });

    // Check if user exists
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found." });
    }

    user.password = newPassword;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error resetting password." });
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