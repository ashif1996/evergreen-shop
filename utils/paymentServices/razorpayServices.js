const Razorpay = require("razorpay");
const crypto = require("crypto");

const User = require("../../models/user");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/product");

const { finalizeOrder } = require("../orderUpdationUtils");
const errorHandler = require("../errorHandlerUtils");
const successHandler = require("../successHandlerUtils");
const HttpStatus = require("../httpStatus");

// Load Razorpay credentials from environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay Order
const createRazorpayOrder = async (orderDetails) => {
  try {
    const razorpayOrder = await razorpay.orders.create(orderDetails);
    return razorpayOrder;
  } catch (error) {
    console.error("Error creating Razorpay order: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Verify Razorpay Payment Signature
const verifyRazorpayPaymentSignature = (
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
) => {
  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  const data = `${razorpayOrderId}|${razorpayPaymentId}`;
  hmac.update(data);
  const generatedSignature = hmac.digest("hex");

  return generatedSignature === razorpaySignature;
};

// Confirm Razorpay Payment
const confirmRazorpayPayment = async (
  razorpayOrderId,
  razorpayPaymentId,
  userId,
  couponId,
) => {
  const order = await Order.findOne({ razorpayOrderId });
  if (!order) {
    throw new Error("Order not found.");
  }

  const orderItems = order.orderItems;
  order.orderPaymentStatus = "Success";
  order.orderStatus = "Pending";
  order.orderItems.forEach((item) => (item.itemStatus = "Pending"));
  order.razorpayPaymentId = razorpayPaymentId;

  await finalizeOrder(userId, order, couponId, orderItems);

  return order;
};

// Handle Razorpay Payment Failure
const handleRazorpayPaymentFailure = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ razorpayOrderId: orderId });
    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    await Order.updateMany(
      {
        $or: [
          { _id: order._id }, // Update the order document
          { "orderItems._id": { $in: order.orderItems.map((item) => item._id) } }, // Update the order items
        ],
      },
      {
        $set: {
          orderStatus: "Failed",
          orderPaymentStatus: "Failed",
          "orderItems.$[].itemStatus": "Failed",
        },
      },
    );

    return successHandler(
      res,
      HttpStatus.PAYMENT_REQUIRED,
      "Order payment failed. You can retry the payment from your order details page.",
    );
  } catch (error) {
    console.error("Error handling payment failure: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  confirmRazorpayPayment,
  handleRazorpayPaymentFailure,
};