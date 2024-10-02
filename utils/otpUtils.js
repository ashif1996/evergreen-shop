const crypto = require("crypto");
const OTP = require("../models/otp");
const transporter = require("../config/email");

// Generate a 6-digit random OTP
const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Store the OTP in the database with an expiration time of 1 minute
const storeOtp = async (email, otp) => {
  await OTP.deleteMany({ email }); // Remove any existing OTP for the email

  const otpDoc = new OTP({
    email,
    otp,
    expiresAt: new Date(Date.now() + 1 * 60 * 1000), // Set expiration time
  });

  await otpDoc.save(); // Save new OTP document
};

// Send the OTP to the user's email
const sendOtp = async (email, otp) => {
  const mailOptions = {
    from: process.env.SEND_OTP_EMAIL, // Sender's email
    to: email, // Recipient's email
    subject: "Your OTP Code", // Email subject
    text: `<p>Your OTP is: <strong>${otp}</strong></p>`, // Email body with OTP
  };

  try {
    await transporter.sendMail(mailOptions); // Send email
    console.log("OTP email sent successfully."); // Log success message
  } catch (error) {
    console.error("Error sending OTP email:", error); // Log error if sending fails
    throw error; // Propagate the error back to the caller if necessary
  }
};

// Verify the OTP entered by the user
const verifyOtp = async (email, userOtp) => {
  const latestOtpDoc = await OTP.findOne({ email })
    .sort({ expiresAt: -1 })
    .exec(); // Find the latest OTP

  if (!latestOtpDoc) {
    return { isVerified: false, reason: "no_otp" }; // No OTP found for the email
  }

  const isExpired = new Date() > latestOtpDoc.expiresAt; // Check if OTP is expired
  if (isExpired) {
    await OTP.deleteOne({ email: latestOtpDoc.email, otp: latestOtpDoc.otp }); // Delete expired OTP
    return { isVerified: false, reason: "expired" }; // Return expired status
  }

  const hash = crypto.createHash("sha256").update(userOtp); // Hash the user-entered OTP
  const hashedUserOtp = hash.digest("hex"); // Get the hashed OTP

  const isMatch = hashedUserOtp === latestOtpDoc.otp; // Compare with stored OTP
  if (isMatch) {
    await OTP.deleteMany({ email }); // Delete all OTPs for the email on successful verification
    return { isVerified: true }; // OTP is verified
  } else {
    return { isVerified: false, reason: "invalid" }; // Return invalid status
  }
};

// Cleanup expired OTPs from the database
const cleanupExpiredOtps = async () => {
  const now = new Date(); // Get current time

  try {
    await OTP.deleteMany({ expiresAt: { $lte: now } }); // Delete expired OTPs
    console.log("Expired OTPs cleaned up successfully."); // Log success message
  } catch (error) {
    console.error("Error cleaning up expired OTPs", error); // Log error if cleanup fails
  }
};

module.exports = {
  generateOtp,
  storeOtp,
  sendOtp,
  verifyOtp,
  cleanupExpiredOtps, // Export functions for OTP management
};
