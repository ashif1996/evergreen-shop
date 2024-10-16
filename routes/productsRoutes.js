const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { isUser, isLoggedIn } = require('../middlewares/authMiddleware');

// Routes for product functionalities
router.get('/list', productController.getProducts);
router.get('/product-details/:id', productController.getProductDetails);
router.get('/rate-product/:id', isUser, isLoggedIn, productController.getRateProduct);
router.post('/rate-product/:id', isUser, isLoggedIn, productController.rateProduct);

module.exports = router;