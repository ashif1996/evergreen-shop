const express = require('express');
const router = express.Router();
const { isUser, isLoggedIn } = require('../middlewares/authMiddleware'); // User authentication middleware
const orderController = require('../controllers/orderController'); // Order controller
const razorpayController = require('../utils/paymentServices/razorpayServices'); // Razorpay services

// Checkout routes with user authentication
router.get('/checkout', isUser, isLoggedIn, orderController.getCheckout); // Get checkout page
router.post('/checkout/apply-coupon', isUser, isLoggedIn, orderController.applyCoupon); // Apply coupon
router.post('/checkout/create/order', isUser, isLoggedIn, orderController.createOrder); // Create order

// Razorpay integration routes
router.post('/checkout/razorpay/verify/confirm', isUser, isLoggedIn, orderController.verifyRazorpayPayment); // Verify payment
router.post('/checkout/razorpay/payment/failed', isUser, isLoggedIn, razorpayController.handleRazorpayPaymentFailure); // Handle payment failure
router.post('/:orderId/payment/razorpay/retry', orderController.retryPayment); // Retry payment for an order

// Order summary and management routes
router.get('/order-summary/:orderId', isUser, isLoggedIn, orderController.getOrderSummary); // Get order summary
router.get('/my-orders', isUser, isLoggedIn, orderController.getUserOrders); // Get user orders
router.get('/my-orders/order-details/:orderId', isUser, isLoggedIn, orderController.getOrderDetails); // Get order details
router.get('/my-orders/:id/invoice/download', orderController.downloadInvoice); // Download invoice
router.post('/my-orders/order-details/cancel/:orderId', isUser, isLoggedIn, orderController.cancelOrder); // Cancel order
router.post('/return-item/:itemId', isUser, isLoggedIn, orderController.returnItem); // Return item

module.exports = router; // Export the router