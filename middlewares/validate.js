const { validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req); // Check for validation errors
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg); // Extract error messages
    console.error("Validation errors:", errorMessages); // Log errors
    req.flash("error_msg", errorMessages.join(" ")); // Flash error message
    return res
      .status(400)
      .json({
        success: false,
        errors: errorMessages,
        originalUrl: req.originalUrl,
      }); // Respond with errors
  }

  next(); // Proceed to next middleware
};

module.exports = validate;