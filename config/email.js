const nodemailer = require("nodemailer");

// Create a transporter object using Gmail SMTP service
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SEND_OTP_EMAIL, // Email used for sending OTPs
    pass: process.env.SEND_OTP_EMAIL_PASS, // Password for the email
  },
  secure: true, // Use secure connection (SSL/TLS)
});

module.exports = transporter;