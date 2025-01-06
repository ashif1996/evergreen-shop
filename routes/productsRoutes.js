const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { isUser, isLoggedIn } = require('../middlewares/authMiddleware');

// Routes for product functionalities
router.get('/list', productController.getProducts);
router.get('/product-details/:id', productController.getProductDetails);

router.route("/rate-product/:id")
    .get(isUser, isLoggedIn, productController.getRateProduct)
    .post(isUser, isLoggedIn, productController.rateProduct);

module.exports = router;