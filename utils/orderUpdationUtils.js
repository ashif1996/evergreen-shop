const User = require("../models/user");
const Product = require("../models/product");
const Cart = require("../models/cartSchema");
const OrderCounter = require("../models/orderCounterSchema");
const mongoose = require("mongoose");
const errorHandler = require("./errorHandlerUtils");
const successHandler = require("./successHandlerUtils");
const HttpStatus = require("../httpStatus");
const ObjectId = mongoose.Types.ObjectId;

// Function to generate order Ids
const generateOrderId = async (next) => {
  try {
    const counter = await OrderCounter.findOneAndUpdate(
      {},
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );
    const year = new Date().getFullYear();
    const paddedSequence = counter.sequence_value.toString().padStart(5, "0");
    return `ORD-${year}-${paddedSequence}`;
  } catch (err) {
    console.error("Error generating order ID: ", err);
    return next(err);
  }
};

// Update user orders and used coupons
const updateUserOrdersAndCoupons = async (userId, orderId, couponId) => {
  const user = await User.findById(userId);
  user.orders.push(orderId);
  if (couponId && ObjectId.isValid(couponId)) {
    user.usedCoupons.push(couponId);
  }
  await user.save();
};

// Update the stock and purchase count of products after order placement
const updateProductStockAndPurchaseCount = async (orderItems) => {
  await Promise.all(
    orderItems.map(async (item) => {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: {
          stock: -item.quantity,
          purchaseCount: item.quantity,
        },
      });
    })
  );
};

// Clear the user's cart after successful order placement
const clearCart = async (userId) => {
  await Cart.findOneAndDelete({ userId });
};

// Finalize the order process by saving the order, updating user orders, products, and clearing the cart.
const finalizeOrder = async (userId, order, couponId, orderItems) => {
  await order.save();
  await updateUserOrdersAndCoupons(userId, order._id, couponId);
  await updateProductStockAndPurchaseCount(orderItems);
  await clearCart(userId);
};

module.exports = {
  generateOrderId,
  updateUserOrdersAndCoupons,
  updateProductStockAndPurchaseCount,
  clearCart,
  finalizeOrder
};