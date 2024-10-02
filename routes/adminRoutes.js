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
router.get('/login', adminController.getAdminLogin); // Render login page
router.post('/login', loginValidationRules, validate, adminController.adminLogin); // Handle login

// Admin dashboard routes
router.get('/dashboard', isAdmin, isAdminLoggedIn, adminController.getDashboard); // View dashboard
router.get('/order/analysis', adminController.getChart); // Order analysis chart
router.get('/logout', adminController.adminLogout); // Logout admin

// Category routes
router.get('/categories', isAdmin, isAdminLoggedIn, adminController.getCategories); // List categories
router.post('/add-category', isAdmin, isAdminLoggedIn, adminController.addCategory); // Add new category
router.post('/update-category', isAdmin, isAdminLoggedIn, adminController.addCategory); // Update category
router.post('/toggle-category/:id', adminController.toggleCategoryListing); // Toggle category visibility

// User management routes
router.get('/users', isAdmin, isAdminLoggedIn, adminController.getUsers); // List users
router.post('/block-user/:userId', isAdmin, isAdminLoggedIn, adminController.blockUser); // Block user
router.post('/unblock-user/:userId', isAdmin, isAdminLoggedIn, adminController.unblockUser); // Unblock user

// Product routes
router.get('/products', isAdmin, isAdminLoggedIn, adminController.getProducts); // List products
router.get('/add-products', isAdmin, isAdminLoggedIn, adminController.getAddProduct); // Add product page
router.post('/add-products', isAdmin, isAdminLoggedIn, uploadMultiple, productValidationRules(), validate, adminController.addProduct); // Add product
router.get('/edit-products/:id', isAdmin, isAdminLoggedIn, adminController.getEditProduct); // Edit product page
router.post('/edit-products/:id', isAdmin, isAdminLoggedIn, uploadMultiple, productValidationRules(true), validate, adminController.editProduct); // Edit product
router.post('/list-product/:productId', isAdmin, isAdminLoggedIn, adminController.listProduct); // List product
router.post('/unlist-product/:productId', isAdmin, isAdminLoggedIn, adminController.unlistProduct); // Unlist product

// Coupon routes
router.get('/coupons', isAdmin, isAdminLoggedIn, adminController.getCoupons); // List coupons
router.get('/add-coupons', isAdmin, isAdminLoggedIn, adminController.getAddCoupon); // Add coupon page
router.post('/add-coupons', isAdmin, isAdminLoggedIn, adminController.addCoupon); // Add coupon
router.get('/edit-coupons/:id', isAdmin, isAdminLoggedIn, adminController.getEditCoupon); // Edit coupon page
router.put('/edit-coupons/:id', isAdmin, isAdminLoggedIn, adminController.editCoupon); // Update coupon
router.post('/activate-coupon/:id', isAdmin, isAdminLoggedIn, adminController.toggleCouponStatus); // Activate coupon
router.post('/deactivate-coupon/:id', isAdmin, isAdminLoggedIn, adminController.toggleCouponStatus); // Deactivate coupon

// Order routes
router.get('/orders', isAdmin, isAdminLoggedIn, adminController.getOrders); // List orders
router.post('/orders/update-order-status/:id', isAdmin, isAdminLoggedIn, adminController.updateOrderStatus); // Update order status
router.get('/orders/order-details/:orderId', isAdmin, isAdminLoggedIn, adminController.getOrderDetails); // Order details
router.post('/orders/:orderId/item/:itemId/status/update', isAdmin, isAdminLoggedIn, adminController.updateItemStatus); // Update item status
router.post('/orders/item/return-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemReturnStatus); // Update return status
router.post('/orders/item/exchange-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemExchangeStatus); // Update exchange status
router.post('/orders/item/refund-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemRefundStatus); // Update refund status
router.post('/orders/order-details/cancel/:orderId', isAdmin, isAdminLoggedIn, orderController.cancelOrder); // Cancel order

// Banner routes
router.get('/banners', isAdmin, isAdminLoggedIn, adminController.getBanner); // List banners
router.get('/banners/add', isAdmin, isAdminLoggedIn, adminController.getAddBanner); // Add banner page
router.post('/banners/add', isAdmin, isAdminLoggedIn, uploadSingle, adminController.addBanner); // Add banner
router.put('/banners/:id', isAdmin, isAdminLoggedIn, uploadSingle, adminController.updateBanner); // Update banner
router.delete('/banners/:id', isAdmin, isAdminLoggedIn, adminController.deleteBanner); // Delete banner

// Offer routes
router.get('/offers', isAdmin, isAdminLoggedIn, adminController.getOffers); // List offers
router.get('/categories/offers/add', isAdmin, isAdminLoggedIn, adminController.getAddCategoryOffers); // Add category offers page
router.post('/categories/offers/add', isAdmin, isAdminLoggedIn, adminController.addCategoryOffers); // Add category offers
router.get('/products/offers/add', isAdmin, isAdminLoggedIn, adminController.getAddProductOffers); // Add product offers page
router.post('/products/offers/add', isAdmin, isAdminLoggedIn, adminController.addProductOffers); // Add product offers
router.get('/categories/offers/all', isAdmin, isAdminLoggedIn, adminController.getCategoryOffers); // List category offers
router.get('/products/offers/all', isAdmin, isAdminLoggedIn, adminController.getProductOffers); // List product offers

module.exports = router; // Export router