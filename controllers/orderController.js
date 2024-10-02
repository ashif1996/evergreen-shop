const fs = require("fs");
const path = require("path");
const Cart = require("../models/cartSchema");
const User = require("../models/user");
const Order = require("../models/orderSchema");
const Coupon = require("../models/couponSchema");
const Address = require("../models/addressSchema");
const Product = require("../models/product");
const pdf = require("pdfkit");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const {
  calculateBestDiscountedPrice,
} = require("../utils/discountPriceCalculation");
const {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  confirmRazorpayPayment,
  handleRazorpayPaymentFailure,
} = require("../utils/paymentServices/razorpayServices");
const {
  generateOrderId,
  finalizeOrder,
} = require("../utils/orderUpdationUtils");
const { errorHandler } = require("../utils/errorHandlerUtils");
const { processRefund } = require("../utils/paymentServices/walletServices");

// Fetch checkout details for the user
const getCheckout = async (req, res) => {
  const userId = req.session.user._id;

  try {
    const user = await User.findById(userId)
      .populate({
        path: "cart",
        populate: [
          {
            path: "items.productId",
            model: "Product",
          },
        ],
      })
      .populate("addresses");

    const cart = user.cart;
    // Check if cart exists and has items
    if (!cart || !cart.subTotal) {
      return errorHandler(res, 400, "Cart is empty or not found.");
    }

    // Retrieve coupon details from session
    const coupon = req.session.coupon || {};
    const couponDiscount = coupon.couponDiscount || 0;
    const couponId = coupon.couponId || null;
    const totalPrice = coupon.totalPrice || cart.subTotal + cart.shippingCharge;

    const locals = {
      title: "Checkout Page | EverGreen",
      user: req.session.user,
      addresses: user.addresses || {},
      cart: cart,
      totalPrice: totalPrice,
      isLoggedIn: req.session.user ? true : false,
      couponDiscount: couponDiscount,
      couponId: couponId,
    };

    res.render("users/orders/checkout.ejs", {
      locals,
      layout: "layouts/userLayout",
    });
  } catch (err) {
    console.error("Error fetching checkout page:", err);
    res
      .status(500)
      .render("error", { message: "Failed to load checkout page." });
  }
};

// Apply a coupon to the user's cart
const applyCoupon = async (req, res) => {
  const { couponCode } = req.body;
  const userId = req.session.user._id;

  try {
    const coupon = await Coupon.findOne({ code: couponCode });
    if (!coupon) {
      return errorHandler(
        res,
        400,
        "Coupon not found. Please try again or use another coupon."
      );
    }

    const user = await User.findById(userId).populate("cart");
    const cart = user.cart;
    if (!user || !user.cart || user.cart.items.length === 0) {
      return errorHandler(res, 400, "Cart is empty or not found");
    }

    if (user.usedCoupons.includes(coupon._id)) {
      return errorHandler(res, 400, "You have already used this coupon.");
    }

    const currentDate = new Date();
    if (coupon.expirationDate && coupon.expirationDate < currentDate) {
      return errorHandler(res, 400, "Coupon has expired");
    }

    if (
      coupon.minimumPurchaseAmount &&
      cart.subTotal < coupon.minimumPurchaseAmount
    ) {
      return errorHandler(
        res,
        400,
        `Minimum purchase amount for this coupon is ₹${coupon.minimumPurchaseAmount}.`
      );
    }

    const couponDiscount =
      coupon.discountType === "PERCENTAGE"
        ? cart.subTotal * (coupon.discountValue / 100)
        : coupon.discountValue;

    const subtotal = cart.subTotal;
    const totalPrice = cart.subTotal + cart.shippingCharge - couponDiscount;

    // Update user's session with coupon details
    req.session.coupon = {
      couponId: coupon._id,
      couponName: coupon.code,
      couponDiscount,
      subtotal,
      totalPrice,
    };

    res.json({
      success: true,
      message: "Coupon applied successfully",
      couponName: coupon.code,
      couponDiscount,
      subtotal,
      totalPrice,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    return errorHandler(res, 500, "An Internal server error occurred.");
  }
};

// Remove a coupon from the user's cart
const removeCoupon = async (req, res) => {
  const userId = req.session.user._id;

  try {
    const user = await User.findById(userId).populate("cart");
    const cart = user.cart;

    if (!user || !user.cart || user.cart.items.length === 0) {
      return errorHandler(res, 400, "Cart is empty or not found");
    }

    // Remove coupon details from session and recalculate total
    if (!req.session.coupon) {
      return errorHandler(res, 400, "No coupon applied to remove.");
    }

    const subtotal = cart.subTotal;
    const totalPrice = cart.subTotal + cart.shippingCharge; // Recalculate without coupon discount

    // Remove coupon from the session
    delete req.session.coupon;

    res.json({
      success: true,
      message: "Coupon removed successfully",
      subtotal,
      totalPrice,
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    return errorHandler(res, 500, "An internal server error occurred.");
  }
};

// Create a new order for the user
const createOrder = async (req, res) => {
  const userId = req.session.user._id;

  try {
    const { paymentMethod, totalPrice, couponId, termsConditions, addressId } =
      req.body;

    // Fetch the cart for the user and populate product and category offers
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId", // Populate the product in the cart items
      select: "price offer category", // Select price, product offer, and category from the product
      populate: {
        path: "category", // Populate category from the product
        select: "offer", // Select only the offer from the category
      },
    });
    if (!cart || cart.items.length === 0) {
      return errorHandler(res, 400, "Your cart is empty.");
    }

    // Get shipping address and validate
    const shippingAddress = await Address.findById(addressId);
    if (!shippingAddress) {
      return errorHandler(res, 400, "Invalid shipping address.");
    }

    // Process coupon if applicable
    let appliedCouponDiscount = 0;
    if (couponId && ObjectId.isValid(couponId)) {
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        return errorHandler(res, 400, "Invalid coupon.");
      }

      appliedCouponDiscount =
        coupon.discountType === "PERCENTAGE"
          ? cart.subTotal * (coupon.discountValue / 100)
          : coupon.discountValue;
    }

    const orderItems = cart.items.map((item) => {
      const product = item.productId;
      const discountDetails = calculateBestDiscountedPrice(product);

      return {
        productId: product._id, // ID of the product
        price: item.price,
        quantity: item.quantity, // How many items
        discountedPrice: discountDetails.discountedPrice, // Final price after discount
        itemTotal: discountDetails.discountedPrice * item.quantity, // Total for this item
        itemStatus: "Pending", // Tracks the status of the item
      };
    });

    // Calculate final total
    const finalTotalPrice = totalPrice - appliedCouponDiscount;

    // Generate a custom order ID using the new function
    const generatedOrderId = await generateOrderId();

    // Prepare the order object (this is the same regardless of payment method)
    const newOrder = new Order({
      userId: userId,
      generatedOrderId,
      orderItems,
      subTotal: cart.subTotal,
      shippingCharge: cart.shippingCharge,
      shippingAddress: shippingAddress._id,
      paymentMethod,
      orderPaymentStatus: "Pending",
      orderStatus: "Pending",
      termsConditions,
      couponId: couponId && ObjectId.isValid(couponId) ? couponId : null,
      couponDiscount: appliedCouponDiscount,
      totalPrice: finalTotalPrice,
    });

    // Use switch for different payment methods
    switch (paymentMethod) {
      case "COD":
        if (newOrder.totalPrice > 1000) {
          return errorHandler(
            res,
            400,
            "Orders above Rs.1000 are not eligible for COD. Please choose another method."
          );
        }

        // Save the order immediately for COD
        await finalizeOrder(userId, newOrder, couponId, orderItems);

        req.session.coupon = null;

        return res.status(200).json({
          success: true,
          message:
            "Order placed Successfully. Please make sure the amount is available when the order is out for delivery.",
          orderId: newOrder._id,
        });

      case "Wallet":
        // Wallet payment - deduct from user's wallet balance and finalize order
        const walletUser = await User.findById(userId).populate(
          "wallet.transactions"
        );
        const wallet = walletUser.wallet;
        if (!wallet || wallet.balance < newOrder.totalPrice) {
          return errorHandler(res, 400, "Insufficient balance in wallet");
        }

        wallet.balance -= newOrder.totalPrice;

        const transaction = {
          amount: newOrder.totalPrice,
          date: new Date(),
          description: "Order payment",
          type: "debit",
          status: "completed",
        };

        wallet.transactions.push(transaction);

        // Update the user's wallet balance and transactions
        await User.findByIdAndUpdate(userId, {
          "wallet.balance": wallet.balance,
          "wallet.transactions": wallet.transactions,
        });

        newOrder.orderPaymentStatus = "Success";

        await finalizeOrder(userId, newOrder, couponId, orderItems);

        req.session.coupon = null;

        return res.status(200).json({
          success: true,
          message: `Order placed successfully. Rs.${finalTotalPrice} has been debited from your wallet.`,
          orderId: newOrder._id,
        });

      case "Razorpay":
        // Razorpay payment - create a Razorpay order and return order details to frontend
        const razorpayOrder = await createRazorpayOrder({
          amount: newOrder.totalPrice * 100,
          receipt: `order_rcptid_${userId}`,
        });

        if (!razorpayOrder) {
          return errorHandler(res, 400, "Failed to create Razorpay order");
        }

        newOrder.razorpayOrderId = razorpayOrder.id;
        await newOrder.save();

        return res.status(200).json({
          success: true,
          message: "Order created successfully! Proceed with Razorpay payment",
          razorpayOrderId: razorpayOrder.id,
          razorpayKeyId: process.env.RAZORPAY_KEY_ID,
          shippingAddress,
          totalAmount: newOrder.totalPrice,
          user: req.session.user,
        });

      default:
        return errorHandler(res, 400, "Invalid payment method");
    }
  } catch (error) {
    console.error("Order creation failed:", error);
    return errorHandler(res, 500, "An Internal server error occurred.");
  }
};

//Function to verify Razorpay payment
const verifyRazorpayPayment = async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    couponId,
  } = req.body;

  // Verify the Razorpay signature
  const isValidSignature = verifyRazorpayPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );
  if (!isValidSignature) {
    return errorHandler(res, 400, "Invalid payment signature");
  }

  try {
    // Confirm the payment and finalize the order
    const order = await confirmRazorpayPayment(
      razorpay_order_id,
      razorpay_payment_id,
      req.session.user._id,
      couponId
    );
    req.session.coupon = null;

    // Check the payment status of the order
    if (order.orderPaymentStatus === "Success") {
      // Payment is confirmed
      return res.status(200).json({
        success: true,
        message: "Payment verified and order confirmed.",
        order,
      });
    } else {
      // Payment failed
      return handleRazorpayPaymentFailure(req, res);
    }
  } catch (error) {
    // If confirmation fails, handle payment failure
    console.error("Payment confirmation failed:", error);
    return handleRazorpayPaymentFailure(req, res);
  }
};

//Function to retry Razorpay payment
const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params; // Get order ID from request params

    const order = await Order.findById(orderId);
    if (!order) {
      return errorHandler(res, 404, "Order not found.");
    }

    if (order.orderPaymentStatus !== "Failed") {
      return errorHandler(res, 400, "Payment already completed.");
    }

    // Return the Razorpay order details for retrying the payment
    res.json({
      success: true,
      razorpayOrderId: order.razorpayOrderId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      totalAmount: order.totalPrice,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Error retrying payment:", error);
    return errorHandler(res, 500, "An internal server error occurred.");
  }
};

// Function for retrieving order summary
const getOrderSummary = async (req, res) => {
  const locals = {
    title: "Order Summary | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };

  try {
    // Extract orderId from URL parameters
    const { orderId } = req.params;

    // Fetch the order details from the database
    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("userId")
      .populate("couponId");

    // Check if order was found
    if (!order) {
      return errorHandler(res, 400, "Order not found");
    }

    // Render the order summary page
    res.render("users/orders/orderSummary.ejs", {
      locals,
      order: order, // Pass the order data to the view
      layout: "layouts/userLayout",
    });
  } catch (err) {
    console.error("Error fetching order summary:", err);
    res
      .status(500)
      .render("error", { message: "Failed to load order summary." });
  }
};

// Fetch and render user's orders with pagination and optional status filter
const getUserOrders = async (req, res) => {
  const locals = {
    title: "My Orders | EverGreen",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };

  const userId = req.session.user._id;
  const page = parseInt(req.query.page || 1);
  const limit = 10; // Orders per page
  const statusFilter = req.query.status || "";

  const skip = (page - 1) * limit;

  // Build query with userId
  let query = { userId };

  // Add status filter if specified
  if (statusFilter && statusFilter !== "all") {
    query.orderStatus = statusFilter;
  }

  const totalOrders = await Order.countDocuments(query); // Count matching orders

  // Fetch orders with pagination
  const orders = await Order.find(query)
    .populate("orderItems.productId")
    .populate("userId")
    .populate("couponId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalOrders / limit); // Calculate total pages

  // Render orders page
  res.status(200).render("users/orders/myOrders.ejs", {
    locals,
    orders,
    currentPage: page,
    totalPages,
    statusFilter,
    layout: "layouts/userLayout",
  });
};

// Fetches and renders order details for a specific order
const getOrderDetails = async (req, res) => {
  const locals = {
    title: "Order Summary | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };

  const nonReturnableStatuses = [
    "Pending",
    "Processing",
    "Shipped",
    "Out for Delivery",
    "Failed",
    "Cancelled",
    "Returned",
    "Exchanged",
  ];
  const nonCancellableStatuses = [
    "Delivered",
    "Cancelled",
    "Failed",
    "Returned",
    "Exchanged",
  ];

  try {
    const { orderId } = req.params;

    // Find the order with the specific orderId
    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("userId")
      .populate("couponId")
      .populate("shippingAddress");

    // Check if order was found
    if (!order) {
      return errorHandler(res, 404, "Order not found.");
    }

    // Check if any item has a non-returnable status
    const hasNonReturnableItem = order.orderItems.some((item) =>
      nonReturnableStatuses.includes(item.itemStatus)
    );

    // Check if any item has a non-cancellable status
    const hasNonCancellableItem = order.orderItems.some((item) =>
      nonCancellableStatuses.includes(item.itemStatus)
    );

    // Check if the order status itself is non-cancellable
    const isOrderNonCancellable = nonCancellableStatuses.includes(
      order.orderStatus
    );

    // Determine if the order can be cancelled
    const showCancelButton = !hasNonCancellableItem && !isOrderNonCancellable;

    // Pass the calculated flags to locals
    locals.hasNonReturnableItem = hasNonReturnableItem;
    locals.showCancelButton = showCancelButton;

    res.status(200).render("users/orders/orderDetails.ejs", {
      locals,
      order,
      csrfToken: req.csrfToken(),
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching order details: ", error);
    res
      .status(500)
      .render("error", { message: "Failed to load order details." });
  }
};

// Function to handle order cancellation
const cancelOrder = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return errorHandler(res, 404, "Order not found.");
    }

    // Check if the order is already cancelled or in a non-cancellable state
    const nonCancellableStatuses = [
      "Delivered",
      "Cancelled",
      "Returned",
      "Exchanged",
    ];
    if (nonCancellableStatuses.includes(order.orderStatus)) {
      return errorHandler(
        res,
        400,
        "Order cannot be cancelled as it is already in a non-cancellable state."
      );
    }

    order.orderStatus = "Cancelled";

    // Update the status of all items in the order to 'Cancelled'
    order.orderItems.forEach((item) => {
      item.itemStatus = "Cancelled";
    });

    // Process refund
    const refundResult = await processRefund(orderId);

    if (!refundResult.success) {
      return errorHandler(res, 400, refundResult.message);
    }

    // If a coupon was applied, remove it and reset the discount
    if (order.couponId) {
      const couponId = order.couponId._id;

      // Remove the coupon from the user's used coupons list
      await User.updateOne(
        { _id: order.userId },
        { $pull: { usedCoupons: couponId } }
      );
    }

    await order.save();

    const response = {
      success: true,
      message: "Order has been cancelled successfully.",
    };

    if (refundResult.refundAmount) {
      response.refundAmount = refundResult.refundAmount; // Include refund amount in response if applicable
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Failed to cancel the order: ", error);
    return errorHandler(res, 500, "An Internal server error occurred.");
  }
};

// Function to handle the return request
const returnItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { returnReason } = req.body;

    const order = await Order.findOne({ "orderItems._id": itemId });
    const item = order.orderItems.id(itemId);

    if (!item) {
      return errorHandler(res, 404, "Item not found.");
    }

    item.returnStatus = "Requested";
    item.returnReason = returnReason;
    item.itemRefundStatus = "Requested";

    await order.save();
    res.redirect(
      `/orders/my-orders/order-details/${order._id}?returnRequestSuccess=true`
    );
  } catch (err) {
    console.error(err);
    return errorHandler(res, 500, "An Internal server error occurred.");
  }
};

// Generate invoice
const generateInvoice = async (orderId) => {
  const invoicesDir = path.join(__dirname, "..", "invoices");

  try {
    // Check if the invoices directory exists, create it if not
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }
  } catch (err) {
    console.error("Error creating invoices directory:", err);
    throw new Error("Error creating invoices directory");
  }

  const filePath = path.join(invoicesDir, `${orderId}.pdf`);

  try {
    // Fetch the order and populate fields
    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("shippingAddress");

    const doc = new pdf();
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // Add title next to the logo
    doc.fontSize(20).text("EverGreen", { align: "center" });

    // Add the header text
    doc.moveDown();
    doc.fontSize(25).text("Invoice", { align: "center" });
    doc.moveDown();

    // Initialize position for item details
    let position = 150; // Starting Y position for the table
    const indexX = 50;
    const descriptionX = 100;
    const quantityX = 280;
    const priceX = 370;
    const amountX = 460;

    // Table header
    doc
      .fontSize(12)
      .text("Index", indexX, position)
      .text("Description", descriptionX, position)
      .text("Quantity", quantityX, position)
      .text("Price", priceX, position)
      .text("Amount", amountX, position);
    position += 20;

    // Table content and total amount calculation
    let totalAmount = 0;

    // Ensure order items and shipping address are populated properly
    order.orderItems.forEach((item, index) => {
      const itemAmount = item.quantity * (item.discountedPrice || item.price);
      totalAmount += itemAmount;

      doc
        .fontSize(10)
        .text(index + 1, indexX, position)
        .text(item.productId.name, descriptionX, position)
        .text(item.quantity, quantityX, position)
        .text(
          `₹${(item.discountedPrice || item.price).toFixed(2)}`,
          priceX,
          position
        )
        .text(`₹${itemAmount.toFixed(2)}`, amountX, position);
      position += 20;
    });

    // Add the total amount
    position += 20;
    doc.fontSize(12).text("Total:", priceX, position, { align: "left" });
    doc.fontSize(12).text(`₹${totalAmount.toFixed(2)}`, amountX, position, {
      align: "right",
    });

    // Move down before adding additional details
    position += 40;
    doc.moveDown();

    // Add shipping address details
    doc.fontSize(14).text("Shipping Address:", indexX, position);
    position += 20;
    const address = order.shippingAddress;
    doc.fontSize(12).text(`${address.address}`, indexX, position);
    position += 15;
    doc.text(
      `${address.city}, ${address.state}, ${address.zipCode}`,
      indexX,
      position
    );

    position += 30;
    doc.fontSize(14).text("Payment Method:", indexX, position);
    position += 20;
    doc.fontSize(12).text(order.paymentMethod, indexX, position);

    position += 30;
    doc.fontSize(14).text("Payment Status:", indexX, position);
    position += 20;
    doc.fontSize(12).text(order.orderPaymentStatus, indexX, position);

    // End the PDF document
    doc.end();

    return new Promise((resolve, reject) => {
      writeStream.on("finish", () => {
        console.log(`Invoice generated successfully at ${filePath}`);
        resolve(filePath);
      });

      writeStream.on("error", (err) => {
        console.error("Error writing PDF to file:", err);
        reject(new Error("Error generating invoice PDF"));
      });
    });
  } catch (err) {
    console.error("Error generating invoice PDF:", err);
    throw new Error("Error generating invoice PDF");
  }
};

// Route to handle invoice download
const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user._id;

    // Find the order and populate the necessary fields
    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate("orderItems.productId") // Populate the product details in order items
      .populate("shippingAddress"); // Populate the shipping address

    if (!order) {
      return errorHandler(res, 404, "Order not found.");
    }

    // Generate the invoice
    const filePath = await generateInvoice(order._id);

    // Check if the file was created successfully
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      console.error("Invoice file does not exist:", filePath);
      return errorHandler(res, 400, "Error generating invoice file");
    }
  } catch (error) {
    console.error("Error generating invoice:", error);
    return errorHandler(res, 500, "An internal server error occurred.");
  }
};

module.exports = {
  getCheckout,
  applyCoupon,
  removeCoupon,
  createOrder,
  verifyRazorpayPayment,
  retryPayment,
  getOrderSummary,
  getUserOrders,
  getOrderDetails,
  cancelOrder,
  returnItem,
  downloadInvoice,
};