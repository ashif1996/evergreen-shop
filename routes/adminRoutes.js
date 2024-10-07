const express = require('express');
const router = express.Router();
const passport = require('passport');
const adminController = require('../controllers/adminController');
const orderController = require('../controllers/orderController');
const { isAdmin, isAdminLoggedIn } = require('../middlewares/authMiddleware');
const { loginValidationRules } = require('../middlewares/validators/userValidators');
const { productValidationRules } = require('../middlewares/validators/productValidators');
const validate = require('../middlewares/validate');
const { uploadSingle, uploadMultiple } = require('../config/multer');

// Admin login routes
router.get('/login', adminController.getAdminLogin);
router.post('/login', loginValidationRules, validate, adminController.adminLogin);

// Admin dashboard routes
router.get('/dashboard', isAdmin, isAdminLoggedIn, adminController.getDashboard);
router.get('/order/analysis', adminController.getChart);
router.get('/logout', adminController.adminLogout);

// Category routes
router.get('/categories', isAdmin, isAdminLoggedIn, adminController.getCategories);
router.post('/add-category', isAdmin, isAdminLoggedIn, adminController.addCategory);
router.post('/update-category', isAdmin, isAdminLoggedIn, adminController.addCategory);
router.post('/toggle-category/:id', adminController.toggleCategoryListing);

// User management routes
router.get('/users', isAdmin, isAdminLoggedIn, adminController.getUsers);
router.post('/block-user/:userId', isAdmin, isAdminLoggedIn, adminController.blockUser);
router.post('/unblock-user/:userId', isAdmin, isAdminLoggedIn, adminController.unblockUser);

// Product routes
router.get('/products', isAdmin, isAdminLoggedIn, adminController.getProducts);
router.get('/add-products', isAdmin, isAdminLoggedIn, adminController.getAddProduct);
router.post('/add-products', isAdmin, isAdminLoggedIn, uploadMultiple, productValidationRules(), validate, adminController.addProduct);
router.get('/edit-products/:id', isAdmin, isAdminLoggedIn, adminController.getEditProduct);
router.put('/edit-products/:id', isAdmin, isAdminLoggedIn, uploadMultiple, productValidationRules(true), validate, adminController.editProduct);
router.post('/list-product/:productId', isAdmin, isAdminLoggedIn, adminController.listProduct);
router.post('/unlist-product/:productId', isAdmin, isAdminLoggedIn, adminController.unlistProduct);

// Coupon routes
router.get('/coupons', isAdmin, isAdminLoggedIn, adminController.getCoupons);
router.get('/add-coupons', isAdmin, isAdminLoggedIn, adminController.getAddCoupon);
router.post('/add-coupons', isAdmin, isAdminLoggedIn, adminController.addCoupon);
router.get('/edit-coupons/:id', isAdmin, isAdminLoggedIn, adminController.getEditCoupon);
router.put('/edit-coupons/:id', isAdmin, isAdminLoggedIn, adminController.editCoupon);
router.post('/activate-coupon/:id', isAdmin, isAdminLoggedIn, adminController.toggleCouponStatus);
router.post('/deactivate-coupon/:id', isAdmin, isAdminLoggedIn, adminController.toggleCouponStatus);

// Order routes
router.get('/orders', isAdmin, isAdminLoggedIn, adminController.getOrders);
router.post('/orders/update-order-status/:id', isAdmin, isAdminLoggedIn, adminController.updateOrderStatus);
router.get('/orders/order-details/:orderId', isAdmin, isAdminLoggedIn, adminController.getOrderDetails);
router.post('/orders/:orderId/item/:itemId/status/update', isAdmin, isAdminLoggedIn, adminController.updateItemStatus);
router.post('/orders/item/return-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemReturnStatus);
router.post('/orders/item/exchange-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemExchangeStatus);
router.post('/orders/item/refund-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemRefundStatus);
router.post('/orders/order-details/cancel/:orderId', isAdmin, isAdminLoggedIn, orderController.cancelOrder);

// Banner routes
router.get('/banners', isAdmin, isAdminLoggedIn, adminController.getBanner);
router.get('/banners/add', isAdmin, isAdminLoggedIn, adminController.getAddBanner);
router.post('/banners/add', isAdmin, isAdminLoggedIn, uploadSingle, adminController.addBanner);
router.put('/banners/:id', isAdmin, isAdminLoggedIn, uploadSingle, adminController.updateBanner);
router.delete('/banners/:id', isAdmin, isAdminLoggedIn, adminController.deleteBanner);

// Offer routes
router.get('/offers', isAdmin, isAdminLoggedIn, adminController.getOffers);
router.get('/categories/offers/add', isAdmin, isAdminLoggedIn, adminController.getAddCategoryOffers);
router.post('/categories/offers/add', isAdmin, isAdminLoggedIn, adminController.addCategoryOffers);
router.get('/products/offers/add', isAdmin, isAdminLoggedIn, adminController.getAddProductOffers);
router.post('/products/offers/add', isAdmin, isAdminLoggedIn, adminController.addProductOffers);
router.get('/categories/offers/all', isAdmin, isAdminLoggedIn, adminController.getCategoryOffers);
router.get('/products/offers/all', isAdmin, isAdminLoggedIn, adminController.getProductOffers);

module.exports = router; // Export router