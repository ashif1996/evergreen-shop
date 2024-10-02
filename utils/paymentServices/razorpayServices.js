const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const crypto = require("crypto");
const User = require("../../models/user");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/product");
const { finalizeOrder } = require("../orderUpdationUtils");

// Load Razorpay credentials from environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create Razorpay Order
 * @param {Object} orderDetails - Details like amount and receipt ID
 * @returns {Object} - The created Razorpay order
 */
const createRazorpayOrder = async (orderDetails) => {
  try {
    const razorpayOrder = await razorpay.orders.create(orderDetails);
    return razorpayOrder;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw new Error("Failed to create Razorpay order");
  }
};

/**
 * Verify Razorpay Payment Signature
 * @param {String} razorpayOrderId - Razorpay order ID
 * @param {String} razorpayPaymentId - Razorpay payment ID
 * @param {String} razorpaySignature - Razorpay signature from the frontend
 * @returns {Boolean} - True if signature is valid, false otherwise
 */
const verifyRazorpayPaymentSignature = (
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
) => {
  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);

  // Create the string to compare with the received signature
  const data = `${razorpayOrderId}|${razorpayPaymentId}`;
  hmac.update(data);
  const generatedSignature = hmac.digest("hex");

  return generatedSignature === razorpaySignature;
};

/**
 * Confirm Razorpay Payment
 * @param {String} razorpayOrderId - Razorpay order ID
 * @param {String} razorpayPaymentId - Razorpay payment ID
 * @param {String} userId - The ID of the user making the payment
 * @returns {Object} - The confirmed order object
 */
const confirmRazorpayPayment = async (
  razorpayOrderId,
  razorpayPaymentId,
  userId,
  couponId
) => {
  // Find the order using the Razorpay order ID
  const order = await Order.findOne({ razorpayOrderId });

  if (!order) {
    throw new Error("Order not found");
  }

  // Extract order items from the order object
  const orderItems = order.orderItems;

  // Update order payment status and details
  order.orderPaymentStatus = "Success";
  order.orderStatus = "Pending";
  order.orderItems.forEach((item) => (item.itemStatus = "Pending"));
  order.razorpayPaymentId = razorpayPaymentId;

  await finalizeOrder(userId, order, couponId, orderItems);

  return order;
};

/**
 * Handle Razorpay Payment Failure
 * @param {Object} req - The request object containing Razorpay failure details
 * @param {Object} res - The response object to send back the result
 * @returns {Object} - JSON response with success/failure message
 */
const handleRazorpayPaymentFailure = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ razorpayOrderId: orderId });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    order.orderStatus = "Failed";
    order.orderPaymentStatus = "Failed";
    await Order.updateMany(
      { "orderItems._id": { $in: order.orderItems.map((item) => item._id) } },
      { $set: { "orderItems.$[].itemStatus": "Failed" } }
    );
    await order.save();

    return res.status(402).json({
      success: true,
      message:
        "Order payment failed. You can retry the payment from your order details page.",
    });
  } catch (error) {
    console.error("Error handling payment failure:", error);
    return res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

// Export all payment-related functions
module.exports = {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  confirmRazorpayPayment,
  handleRazorpayPaymentFailure,
};