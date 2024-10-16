const express = require('express');
const router = express.Router();
const { isUser, isLoggedIn } = require('../middlewares/authMiddleware');
const orderController = require('../controllers/orderController');
const razorpayController = require('../utils/paymentServices/razorpayServices');

// Checkout routes with user authentication
router.get('/checkout', isUser, isLoggedIn, orderController.getCheckout);
router.post('/checkout/apply-coupon', isUser, isLoggedIn, orderController.applyCoupon);
router.post('/checkout/remove-coupon', isUser, isLoggedIn, orderController.removeCoupon);
router.post('/checkout/create/order', isUser, isLoggedIn, orderController.createOrder);

// Razorpay integration routes
router.post('/checkout/razorpay/verify/confirm', isUser, isLoggedIn, orderController.verifyRazorpayPayment);
router.post('/checkout/razorpay/payment/failed', isUser, isLoggedIn, razorpayController.handleRazorpayPaymentFailure);
router.post('/:orderId/payment/razorpay/retry', orderController.retryPayment);

// Order summary and management routes
router.get('/order-summary/:orderId', isUser, isLoggedIn, orderController.getOrderSummary);
router.get('/my-orders', isUser, isLoggedIn, orderController.getUserOrders);
router.get('/my-orders/order-details/:orderId', isUser, isLoggedIn, orderController.getOrderDetails);
router.get('/my-orders/:id/invoice/download', orderController.downloadInvoice);
router.post('/my-orders/order-details/cancel/:orderId', isUser, isLoggedIn, orderController.cancelOrder);
router.post('/return-item/:itemId', isUser, isLoggedIn, orderController.returnItem);

module.exports = router;