const { body } = require("express-validator");

const productValidationRules = (isEdit = false) => [
  body("name")
    .notEmpty()
    .withMessage("Product name is required")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Product name must be a valid name and cannot contain numbers"),
  body("price")
    .isFloat({ gt: 0 })
    .withMessage("Price must be a positive number"),
  body("discountPrice")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Discount price must be a positive number"),
  body("description").notEmpty().withMessage("Description is required"),
  body("stock")
    .notEmpty()
    .withMessage("Stock is required")
    .isFloat({ gte: 0 })
    .withMessage("Stock must be a positive integer"),
  body("availability")
    .isBoolean()
    .withMessage("Availability must be true or false"),
  body("images").custom((value, { req }) => {
    if (!isEdit) {
      if (!req.files || req.files.length === 0) {
        throw new Error("At least one image is required");
      }
    }

    if (req.files) {
      for (const file of req.files) {
        if (!file.mimetype.startsWith("image/")) {
          throw new Error("Only image files are allowed");
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error("Image size should not exceed 5MB");
        }
      }
    }

    return true;
  }),
  body("category").notEmpty().withMessage("Category is required"),
];

module.exports = {
  productValidationRules
};