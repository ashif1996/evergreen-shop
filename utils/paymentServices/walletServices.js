const Razorpay = require("razorpay");
const crypto = require("crypto");
const User = require("../../models/user");
const Order = require("../../models/orderSchema");
const errorHandler = require("../errorHandlerUtils");
const successHandler = require("../successHandlerUtils");
const HttpStatus = require("../httpStatus");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Fetch user's wallet and transaction history
const getWallet = async (req, res, next) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false
  };

  try {
    const userId = req.session.user._id;

    const user = await User.findById(userId).select("wallet");
    if (!user) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
    }

    const wallet = user.wallet;
    if (wallet.transactions) {
      wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return res.render("users/wallet.ejs", {
      locals,
      wallet,
      layout: "layouts/userLayout"
    });
  } catch (err) {
    console.error("Error fetching wallet data: ", err);
    return next(err);
  }
};

// Render the add money form
const getAddWalletMoney = async (req, res, next) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false
  };

  try {
    return res.render("users/addWalletMoney.ejs", {
      locals,
      layout: "layouts/userLayout"
    });
  } catch (err) {
    console.error("Error rendering add money form: ", err);
    return next(err);
  }
};

// Initiate a Razorpay payment order
const initiatePayment = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false
  };

  try {
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount." });
    }

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${new Date().getTime()}`,
      notes: {
        description: note || "Adding money to wallet."
      },
    };

    const order = await razorpayInstance.orders.create(options);

    res.json({
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      id: order.id,
      notes: order.notes
    });
  } catch (err) {
    console.error("Error initiating payment: ", err);
    throw new Error("Error initiating payment");
  }
};

// Verify the Razorpay payment signature and update the wallet
const verifyPayment = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false
  };

  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
      note
    } = req.body;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature === razorpay_signature) {
      try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (!user) {
          return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
        }

        user.wallet.balance += amount / 100;
        user.wallet.transactions.push({
          amount: amount / 100,
          description: note || "Added to wallet.",
          type: "credit",
          status: "completed"
        });

        await user.save();

        return successHandler(res, HttpStatus.OK, "Payment verified and wallet updated.");
      } catch (err) {
        console.error("Error updating wallet: ", err);
        return next(err);
      }
    } else {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Payment verification failed.");
    }
  } catch (err) {
    console.error("Error verifying payment: ", err);
    throw new Error("Error verifying payment");
  }
};

// Function to process refund to wallet
const processRefund = async (orderId, itemId = null) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return { success: false, message: "Order not found." };
    }

    let refundAmount;
    let item = null;

    if (itemId) {
      item = order.orderItems.find((item) => item._id.toString() === itemId);
      if (!item) {
        return { success: false, message: "Item not found in the order." };
      }

      refundAmount = item.itemTotal;
      item.itemStatus = "Returned";
      item.returnStatus = "Approved";
      item.itemRefundStatus = "Completed";
    } else {
      const refundEligibility = ["Razorpay", "Wallet"];

      if (refundEligibility.includes(order.paymentMethod)) {
        refundAmount = order.totalPrice;

        order.orderPaymentStatus = "Refunded";
      } else {
        refundAmount = 0;
      }
    }

    if (refundAmount > 0) {
      const walletUser = await User.findByIdAndUpdate(
        order.userId,
        {
          $inc: { "wallet.balance": refundAmount },
          $push: {
            "wallet.transactions": {
              amount: refundAmount,
              date: new Date(),
              description: itemId
                ? `Refund for item ${item.name}.`
                : "Order cancelled successfully.",
              type: "credit",
              status: "completed",
            },
          },
        },
        { new: true }
      );

      if (!walletUser) {
        return { success: false, message: "User not found." };
      }
    }

    await order.save();

    return {
      success: true,
      refundAmount,
      refundedItem: itemId ? item : null,
      message: itemId
        ? `Item ${item.name} returned successfully.`
        : "Order cancelled successfully."
    };
  } catch (err) {
    console.error("Error processing refund: ", err);
    throw new Error("Error processing refund");
  }
};

module.exports = {
  getWallet,
  getAddWalletMoney,
  initiatePayment,
  verifyPayment,
  processRefund
};