const crypto = require("crypto");
const OTP = require("../models/otp");
const transporter = require("../config/email");

// Generate a 6-digit random OTP
const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Store the OTP in the database with an expiration time of 1 minute
const storeOtp = async (email, otp) => {
  await OTP.deleteMany({ email });

  const otpDoc = new OTP({
    email,
    otp,
    expiresAt: new Date(Date.now() + 2 * 60 * 1000), // Set expiration time
  });

  await otpDoc.save();
};

// Send the OTP to the user's email
const sendOtp = async (email, otp) => {
  const mailOptions = {
    from: process.env.SEND_OTP_EMAIL,
    to: email,
    subject: "Your OTP Code",
    text: `<p>Your OTP is: <strong>${otp}</strong></p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully.");
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw error;
  }
};

// Verify the OTP entered by the user
const verifyOtp = async (email, userOtp) => {
  const latestOtpDoc = await OTP.findOne({ email })
    .sort({ expiresAt: -1 })
    .exec();

  if (!latestOtpDoc) {
    return { isVerified: false, reason: "no_otp" };
  }

  const isExpired = new Date() > latestOtpDoc.expiresAt;
  if (isExpired) {
    await OTP.deleteOne({ email: latestOtpDoc.email, otp: latestOtpDoc.otp });
    return { isVerified: false, reason: "expired" };
  }

  const hash = crypto.createHash("sha256").update(userOtp);
  const hashedUserOtp = hash.digest("hex");

  const isMatch = hashedUserOtp === latestOtpDoc.otp;
  if (isMatch) {
    await OTP.deleteMany({ email });
    return { isVerified: true };
  } else {
    return { isVerified: false, reason: "invalid" };
  }
};

// Cleanup expired OTPs from the database
const cleanupExpiredOtps = async () => {
  const now = new Date(); // Get current time

  try {
    await OTP.deleteMany({ expiresAt: { $lte: now } });
    console.log("Expired OTPs cleaned up successfully.");
  } catch (error) {
    console.error("Error cleaning up expired OTPs", error);
  }
};

module.exports = {
  generateOtp,
  storeOtp,
  sendOtp,
  verifyOtp,
  cleanupExpiredOtps, // Export functions for OTP management
};
