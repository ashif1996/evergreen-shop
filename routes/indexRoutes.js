const express = require('express');
const router = express.Router();
const { checkLoginStatus } = require('../middlewares/checkLoginStatus'); // Middleware to check login status

const indexController = require('../controllers/indexController'); // Import index controller

// Home route with login status check
router.get('/', checkLoginStatus, indexController.getHome);

// Search route for products
router.get('/search', indexController.searchProducts);

module.exports = router; // Export the router