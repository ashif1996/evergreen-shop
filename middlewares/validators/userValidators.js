const { body } = require("express-validator");

// Validation rules for signup
const signupValidationRules = [
  body("firstName")
    .notEmpty()
    .withMessage("First name is required.") // Required and must be letters
    .isAlpha()
    .withMessage("Please enter a valid first name. Only letters are allowed."),
  body("lastName")
    .notEmpty()
    .withMessage("Last name is required.") // Required and must be letters
    .isAlpha()
    .withMessage("Please enter a valid last name. Only letters are allowed."),
  body("email")
    .notEmpty()
    .withMessage("Email is required.") // Required and must be a valid email
    .isEmail()
    .withMessage("Please enter a valid email address."),
  body("password")
    .notEmpty()
    .withMessage("Password is required.") // Required and must be at least 8 characters
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long."),
  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your password.") // Required and must match password
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match."); // Passwords must match
      }
      return true;
    }),
];

// Validation rules for login
const loginValidationRules = [
  body("email")
    .notEmpty()
    .withMessage("Email is required.") // Required and must be a valid email
    .isEmail()
    .withMessage("Please enter a valid email address."),
  body("password").notEmpty().withMessage("Password is required."), // Required
];

// Validation rules for OTP email
const otpEmailValidationRules = [
  body("email")
    .notEmpty()
    .withMessage("Email is required.") // Required and must be a valid email
    .isEmail()
    .withMessage("Please enter a valid email address."),
];

// Validation rules for OTP input
const otpValidationRules = [
  body("otp")
    .notEmpty()
    .withMessage("Please enter the OTP.") // Required and must be numeric
    .isNumeric()
    .withMessage("OTP must be numeric.")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits long."), // Must be exactly 6 digits
];

// Validation rules for password reset
const resetPasswordValidationRules = [
  body("newPassword")
    .notEmpty()
    .withMessage("Password is required.") // Required and must be at least 8 characters
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long."),
  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your password.") // Required and must match new password
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Passwords do not match."); // Passwords must match
      }
      return true;
    }),
];

module.exports = {
  signupValidationRules,
  loginValidationRules,
  otpEmailValidationRules,
  otpValidationRules,
  resetPasswordValidationRules, // Export all validation rules
};