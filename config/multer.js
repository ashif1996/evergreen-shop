const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Define a single upload directory
const uploadDir = path.join(__dirname, "..", "public", "images", "products");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Configure file filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"), false);
  }
};

// Create Multer instance for single file uploads (e.g., banners)
const uploadSingle = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5 MB
  },
}).single("imageUrl"); // Use for single file uploads

// Create Multer instance for multiple files uploads (e.g., products)
const uploadMultiple = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5 MB
  },
}).array("images", 4); // Use for multiple files uploads

module.exports = { uploadSingle, uploadMultiple };