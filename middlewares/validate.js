const { validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    console.error("Validation errors:", errorMessages);
    req.flash("error_msg", errorMessages.join(" "));
    return res
      .json({
        success: false,
        errors: errorMessages,
        originalUrl: req.originalUrl
      });
  }

  next();
};

module.exports = validate;