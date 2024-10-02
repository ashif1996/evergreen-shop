const Razorpay = require("razorpay");
const crypto = require("crypto");
const User = require("../../models/user"); // Import the User model
const Order = require("../../models/orderSchema");

// Initialize Razorpay instance with your credentials
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Fetch user's wallet and transaction history
const getWallet = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };

  try {
    if (!locals.isLoggedIn) {
      const errorMessage =
        "You must be logged in to access this page. Return back to login page.";
      return res.redirect(
        `/error?statusCode=401&errorMessage=${encodeURIComponent(errorMessage)}`
      );
    }

    const userId = req.session.user._id;

    // Fetch the user's wallet information directly from the User model
    const user = await User.findById(userId).select("wallet");

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Extract and sort wallet details
    const wallet = user.wallet;
    if (wallet.transactions) {
      wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    res.render("users/wallet.ejs", {
      locals,
      wallet,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching wallet data:", error);
    res.status(500).send("Server error");
  }
};

// Render the add money form
const getAddWalletMoney = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };

  try {
    if (!locals.isLoggedIn) {
      const errorMessage =
        "You must be logged in to access this page. Return back to login page.";
      return res.redirect(
        `/error?statusCode=401&errorMessage=${encodeURIComponent(errorMessage)}`
      );
    }

    res.render("users/addWalletMoney.ejs", {
      locals,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error rendering add money form:", error);
    res.status(500).redirect("/users/wallet"); // Redirect to login on error
  }
};

// Initiate a Razorpay payment order
const initiatePayment = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };

  try {
    if (!locals.isLoggedIn) {
      const errorMessage =
        "You must be logged in to access this page. Return back to login page.";
      return res.redirect(
        `/error?statusCode=401&errorMessage=${encodeURIComponent(errorMessage)}`
      );
    }

    const { amount, note } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const options = {
      amount: amount * 100, // amount in paisa
      currency: "INR",
      receipt: `receipt_${new Date().getTime()}`,
      notes: {
        description: note || "Adding money to wallet",
      },
    };

    const order = await razorpayInstance.orders.create(options);

    // Send the key_id and order back to the client
    res.json({
      key_id: process.env.RAZORPAY_KEY_ID, // Razorpay key ID (public)
      amount: order.amount,
      currency: order.currency,
      id: order.id, // Razorpay order ID
      notes: order.notes,
    });
  } catch (error) {
    console.error("Error initiating payment:", error); // Log the error details
    res
      .status(500)
      .json({ error: "Server error occurred. Please try again later." });
  }
};

// Verify the Razorpay payment signature and update the wallet
const verifyPayment = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };

  try {
    if (!locals.isLoggedIn) {
      const errorMessage =
        "You must be logged in to access this page. Return back to login page.";
      return res.redirect(
        `/error?statusCode=401&errorMessage=${encodeURIComponent(errorMessage)}`
      );
    }

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
      note,
    } = req.body;

    // Generate the expected signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature === razorpay_signature) {
      try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        // If no user found, return an error
        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }

        // Update wallet balance and add transaction
        user.wallet.balance += amount / 100; // Convert from paisa to rupees
        user.wallet.transactions.push({
          amount: amount / 100,
          description: note || "Added to wallet",
          type: "credit",
          status: "completed",
        });

        // Save the user document
        await user.save();

        res.json({
          success: true,
          message: "Payment verified and wallet updated",
        });
      } catch (error) {
        console.error("Error updating wallet:", error);
        res.status(500).json({ success: false, message: "Server error" });
      }
    } else {
      res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Function to process refund to wallet
const processRefund = async (orderId, itemId = null) => {
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return { success: false, message: "Order not found!" };
    }

    let refundAmount;
    let item = null;

    // If itemId is provided, handle item return
    if (itemId) {
      // Find the item being returned
      item = order.orderItems.find((item) => item._id.toString() === itemId);

      if (!item) {
        return { success: false, message: "Item not found in the order!" };
      }

      // Refund the price of the specific item without checking payment method
      refundAmount = item.itemTotal;

      // Update the item's statuses
      item.itemStatus = "Returned";
      item.returnStatus = "Approved";
      item.itemRefundStatus = "Completed";
    } else {
      // Full order return case - only check refund eligibility
      const refundEligibility = ["Razorpay", "Wallet"];

      if (refundEligibility.includes(order.paymentMethod)) {
        // Refund the total price of the order if payment method is eligible
        refundAmount = order.totalPrice;

        // Mark the order's payment status as refunded
        order.orderPaymentStatus = "Refunded";
      } else {
        // Payment method not eligible for refund, proceed without refund
        refundAmount = 0;
      }
    }

    // Update the user's wallet with the refund
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
        { new: true } // Return the updated document
      );

      if (!walletUser) {
        return { success: false, message: "User not found!" };
      }
    }

    // Save the updated order
    await order.save();

    return {
      success: true,
      refundAmount,
      refundedItem: itemId ? item : null,
      message: itemId
        ? `Item ${item.name} returned successfully.`
        : "Order cancelled successfully.",
    };
  } catch (error) {
    console.error("Error processing refund:", error);
    return {
      success: false,
      message: "An error occurred while processing the refund",
    };
  }
};

module.exports = {
  getWallet,
  getAddWalletMoney,
  initiatePayment,
  verifyPayment,
  processRefund,
};