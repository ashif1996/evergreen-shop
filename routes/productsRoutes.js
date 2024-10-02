const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController'); // Product controller
const { isUser, isLoggedIn } = require('../middlewares/authMiddleware'); // Authentication middleware

// Routes for product functionalities
router.get('/list', productController.getProducts); // Get list of products
router.get('/product-details/:id', productController.getProductDetails); // Get product details by ID
router.get('/rate-product/:id', isUser, isLoggedIn, productController.getRateProduct); // Get rating page for product
router.post('/rate-product/:id', isUser, isLoggedIn, productController.rateProduct); // Submit rating for product

module.exports = router; // Export the router