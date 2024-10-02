const { body } = require("express-validator");

// Validation rules for product input
const productValidationRules = (isEdit = false) => [
  body("name")
    .notEmpty()
    .withMessage("Product name is required") // Name cannot be empty
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage(
      "Product name must be a valid name and cannot contain numbers"
    ), // Name must be letters only
  body("price")
    .isFloat({ gt: 0 })
    .withMessage("Price must be a positive number"), // Price must be a positive float
  body("discountPrice")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Discount price must be a positive number"), // Optional discount price, must be positive if provided
  body("description").notEmpty().withMessage("Description is required"), // Description cannot be empty
  body("stock")
    .notEmpty()
    .withMessage("Stock is required")
    .isFloat({ gt: 0 })
    .withMessage("Stock must be a positive integer"), // Stock must be a positive float
  body("availability")
    .isBoolean()
    .withMessage("Availability must be true or false"), // Availability must be a boolean
  body("images").custom((value, { req }) => {
    if (!isEdit) {
      // Check images only on creation, not on edit
      if (!req.files || req.files.length === 0) {
        throw new Error("At least one image is required"); // At least one image required for new products
      }
    }

    // Validate each uploaded image
    if (req.files) {
      for (const file of req.files) {
        if (!file.mimetype.startsWith("image/")) {
          throw new Error("Only image files are allowed"); // Only image files permitted
        }
        if (file.size > 5 * 1024 * 1024) {
          // Limit file size to 5MB
          throw new Error("Image size should not exceed 5MB"); // Max size error
        }
      }
    }

    return true; // Validation passed
  }),
  body("category").notEmpty().withMessage("Category is required"), // Category cannot be empty
];

module.exports = {
  productValidationRules, // Export validation rules
};