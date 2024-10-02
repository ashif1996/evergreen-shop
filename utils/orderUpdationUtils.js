const User = require("../models/user");
const Product = require("../models/product");
const Cart = require("../models/cartSchema");
const OrderCounter = require("../models/orderCounterSchema");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// Function to generate order Ids
const generateOrderId = async () => {
  try {
    const counter = await OrderCounter.findOneAndUpdate(
      {},
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );
    const year = new Date().getFullYear();
    const paddedSequence = counter.sequence_value.toString().padStart(5, "0");
    return `ORD-${year}-${paddedSequence}`;
  } catch (error) {
    console.error("Error generating order ID:", error);
    throw new Error("Failed to generate order ID");
  }
};

/**
 * Update user orders and used coupons
 * @param {String} userId - The ID of the user
 * @param {String} orderId - The ID of the order
 * @param {String} couponId - The ID of the coupon
 */
const updateUserOrdersAndCoupons = async (userId, orderId, couponId) => {
  const user = await User.findById(userId);
  user.orders.push(orderId);
  if (couponId && ObjectId.isValid(couponId)) {
    user.usedCoupons.push(couponId);
  }
  await user.save();
};

/**
 * Update the stock and purchase count of products after order placement
 * @param {Array} orderItems - The items in the order
 */
const updateProductStockAndPurchaseCount = async (orderItems) => {
  await Promise.all(
    orderItems.map(async (item) => {
      // Update stock by reducing it based on the order quantity
      await Product.findByIdAndUpdate(item.productId, {
        $inc: {
          stock: -item.quantity,
          purchaseCount: item.quantity, // Increment purchase count
        },
      });
    })
  );
};

/**
 * Clear the user's cart after successful order placement
 * @param {String} userId - The ID of the user
 */
const clearCart = async (userId) => {
  await Cart.findOneAndDelete({ userId });
};

/**
 * Finalize the order process by saving the order, updating user orders, products, and clearing the cart.
 *
 * @param {String} userId - The ID of the user placing the order.
 * @param {Object} order - The order object to be saved in the database.
 * @param {String|null} couponId - The ID of the coupon used for the order (if applicable).
 * @param {Array} orderItems - The items included in the order (product IDs, quantity, etc.).
 *
 * @returns {Promise<void>} - A promise that resolves when the order process is completed.
 */
const finalizeOrder = async (userId, order, couponId, orderItems) => {
  // Save the order to the database
  await order.save();

  // Update the user's order history and coupon usage
  await updateUserOrdersAndCoupons(userId, order._id, couponId);

  // Update stock levels and purchase count for the products in the order
  await updateProductStockAndPurchaseCount(orderItems);

  // Clear the user's cart after the order is placed
  await clearCart(userId);
};

module.exports = {
  generateOrderId,
  updateUserOrdersAndCoupons,
  updateProductStockAndPurchaseCount,
  clearCart,
  finalizeOrder,
};