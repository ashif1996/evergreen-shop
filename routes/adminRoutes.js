const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const orderController = require('../controllers/orderController');

const { isAdmin, isAdminLoggedIn } = require('../middlewares/authMiddleware');
const { loginValidationRules } = require('../middlewares/validators/userValidators');
const { productValidationRules } = require('../middlewares/validators/productValidators');
const validate = require('../middlewares/validate');
const { uploadSingle, uploadMultiple } = require('../config/multer');

// Admin login routes
router.route("/login")
    .get(adminController.getAdminLogin)
    .post(loginValidationRules, validate, adminController.adminLogin);

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

router.route("/add-products")
    .get(isAdmin, isAdminLoggedIn, adminController.getAddProduct)
    .post(isAdmin, isAdminLoggedIn, uploadMultiple, productValidationRules(), validate, adminController.addProduct);

router.route("/edit-products/:id")
    .get(isAdmin, isAdminLoggedIn, adminController.getEditProduct)
    .put(isAdmin, isAdminLoggedIn, uploadMultiple, productValidationRules(true), validate, adminController.editProduct);

router.post('/list-product/:productId', isAdmin, isAdminLoggedIn, adminController.listProduct);
router.post('/unlist-product/:productId', isAdmin, isAdminLoggedIn, adminController.unlistProduct);

// Coupon routes
router.get('/coupons', isAdmin, isAdminLoggedIn, adminController.getCoupons);

router.route("/add-coupons")
    .get(isAdmin, isAdminLoggedIn, adminController.getAddCoupon)
    .post(isAdmin, isAdminLoggedIn, adminController.addCoupon);

router.route("/edit-coupons/:id")
    .get(isAdmin, isAdminLoggedIn, adminController.getEditCoupon)
    .put(isAdmin, isAdminLoggedIn, adminController.editCoupon);

router.post('/activate-coupon/:id', isAdmin, isAdminLoggedIn, adminController.toggleCouponStatus);
router.post('/deactivate-coupon/:id', isAdmin, isAdminLoggedIn, adminController.toggleCouponStatus);

// Order routes
router.get('/orders', isAdmin, isAdminLoggedIn, adminController.getOrders);
router.get('/orders/order-details/:orderId', isAdmin, isAdminLoggedIn, adminController.getOrderDetails);
router.post('/orders/update-order-status/:id', isAdmin, isAdminLoggedIn, adminController.updateOrderStatus);
router.post('/orders/order-details/cancel/:orderId', isAdmin, isAdminLoggedIn, orderController.cancelOrder);

router.post('/orders/:orderId/item/:itemId/status/update', isAdmin, isAdminLoggedIn, adminController.updateItemStatus);
router.post('/orders/item/return-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemReturnStatus);
router.post('/orders/item/exchange-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemExchangeStatus);
router.post('/orders/item/refund-status/update', isAdmin, isAdminLoggedIn, adminController.updateItemRefundStatus);

// Banner routes
router.get('/banners', isAdmin, isAdminLoggedIn, adminController.getBanner);

router.route("/banners/add")
    .get(isAdmin, isAdminLoggedIn, adminController.getAddBanner)
    .post(isAdmin, isAdminLoggedIn, uploadSingle, adminController.addBanner);

router.route("/banners/:id")
    .put(isAdmin, isAdminLoggedIn, uploadSingle, adminController.updateBanner)
    .delete(isAdmin, isAdminLoggedIn, adminController.deleteBanner);

// Offer routes
router.get('/offers', isAdmin, isAdminLoggedIn, adminController.getOffers);

router.route("/categories/offers/add")
    .get(isAdmin, isAdminLoggedIn, adminController.getAddCategoryOffers)
    .post(isAdmin, isAdminLoggedIn, adminController.addCategoryOffers);

router.route("/products/offers/add")
    .get(isAdmin, isAdminLoggedIn, adminController.getAddProductOffers)
    .post(isAdmin, isAdminLoggedIn, adminController.addProductOffers);

router.get('/categories/offers/all', isAdmin, isAdminLoggedIn, adminController.getCategoryOffers);

router.get('/products/offers/all', isAdmin, isAdminLoggedIn, adminController.getProductOffers);

module.exports = router;