const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const pdf = require("pdfkit");

const Address = require("../models/addressSchema");
const Cart = require("../models/cartSchema");
const Coupon = require("../models/couponSchema");
const Order = require("../models/orderSchema");
const User = require("../models/user");

const { calculateBestDiscountedPrice } = require("../utils/discountPriceCalculation");
const {
  confirmRazorpayPayment,
  createRazorpayOrder,
  handleRazorpayPaymentFailure,
  verifyRazorpayPaymentSignature,
} = require("../utils/paymentServices/razorpayServices");
const { finalizeOrder, generateOrderId } = require("../utils/orderUpdationUtils");
const HttpStatus = require("../utils/httpStatus");
const errorHandler = require("../utils/errorHandlerUtils");
const { processRefund } = require("../utils/paymentServices/walletServices");
const ObjectId = mongoose.Types.ObjectId;

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
    if (!cart || !cart.subTotal) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Cart is empty or not found.");
    }

    // Retrieve coupon details from session
    const coupon = req.session.coupon || {};
    const couponDiscount = coupon.couponDiscount || 0;
    const couponId = coupon.couponId || null;
    const totalPrice = coupon.totalPrice || cart.subTotal + cart.shippingCharge;

    const locals = {
      title: "Checkout Page | EverGreen",
      user: req.session.user,
      isLoggedIn: !!req.session.user,
      addresses: user.addresses || {},
      cart: cart,
      totalPrice: totalPrice,
      couponDiscount: couponDiscount,
      couponId: couponId,
    };

    res.render("users/orders/checkout", {
      locals,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching checkout page: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Apply a coupon to the user's cart
const applyCoupon = async (req, res) => {
  const { couponCode } = req.body;
  const userId = req.session.user._id;

  try {
    const coupon = await Coupon.findOne({ code: couponCode });
    if (!coupon) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Invalid Coupon! Please try again or use another coupon.");
    }

    const user = await User.findById(userId).populate("cart");
    const cart = user.cart;
    if (!user || !user.cart || user.cart.items.length === 0) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Cart is empty or not found.");
    }

    if (user.usedCoupons.includes(coupon._id)) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "You have already used this coupon.");
    }

    const currentDate = new Date();
    if (coupon.expirationDate && coupon.expirationDate < currentDate) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Coupon has expired.");
    }

    if (coupon.minimumPurchaseAmount && cart.subTotal < coupon.minimumPurchaseAmount) {
      return errorHandler(
        res,
        HttpStatus.BAD_REQUEST,
        `Minimum purchase amount for this coupon is ₹${coupon.minimumPurchaseAmount}.`,
      );
    }

    const couponDiscount = coupon.discountType === "PERCENTAGE"
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

    return res.status(HttpStatus.OK).json({
      success: true,
      message: `Coupon ${coupon.code} applied successfully.`,
      couponName: coupon.code,
      couponDiscount,
      subtotal,
      totalPrice,
    });
  } catch (error) {
    console.error("Error applying coupon: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Remove a coupon from the user's cart
const removeCoupon = async (req, res) => {
  const userId = req.session.user._id;

  try {
    const user = await User.findById(userId).populate("cart");
    const cart = user.cart;
    if (!user || !user.cart || user.cart.items.length === 0) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Cart is empty or not found");
    }

    if (!req.session.coupon) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "No coupon applied to remove.");
    }

    const subtotal = cart.subTotal;
    const totalPrice = cart.subTotal + cart.shippingCharge;

    delete req.session.coupon;

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Coupon removed successfully.",
      subtotal,
      totalPrice,
    });
  } catch (error) {
    console.error("Error removing coupon: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Create a new order for the user
const createOrder = async (req, res) => {
  const userId = req.session.user._id;

  try {
    const { paymentMethod, totalPrice, couponId, termsConditions, addressId } = req.body;

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        select: "price offer category",
          populate: {
            path: "category",
            select: "offer",
          }
      });

    if (!cart || cart.items.length === 0) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Your cart is empty.");
    }

    const shippingAddress = await Address.findById(addressId);
    if (!shippingAddress) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Invalid shipping address.");
    }

    let appliedCouponDiscount = 0;
    if (couponId && ObjectId.isValid(couponId)) {
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        return errorHandler(res, HttpStatus.BAD_REQUEST, "Invalid coupon.");
      }

      appliedCouponDiscount = coupon.discountType === "PERCENTAGE"
          ? cart.subTotal * (coupon.discountValue / 100)
          : coupon.discountValue;
    }

    const orderItems = cart.items.map((item) => {
      const product = item.productId;
      const discountDetails = calculateBestDiscountedPrice(product);

      return {
        productId: product._id,
        price: item.price,
        quantity: item.quantity,
        discountedPrice: discountDetails.discountedPrice,
        itemTotal: discountDetails.discountedPrice * item.quantity,
        itemStatus: "Pending",
      };
    });

    const finalTotalPrice = totalPrice - appliedCouponDiscount;
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

    switch (paymentMethod) {
      case "COD":
        if (newOrder.totalPrice > 1000) {
          return errorHandler(
            res,
            HttpStatus.BAD_REQUEST,
            "Orders above Rs.1000 are not eligible for COD. Please choose another method."
          );
        }

        await finalizeOrder(userId, newOrder, couponId, orderItems);
        req.session.coupon = null;

        return res.status(HttpStatus.OK).json({
          success: true,
          message: "Order placed Successfully. Please make sure the amount is available when the order is out for delivery.",
          orderId: newOrder._id,
        });

      case "Wallet":
        const walletUser = await User.findById(userId).populate("wallet.transactions");
        const wallet = walletUser.wallet;
        if (!wallet || wallet.balance < newOrder.totalPrice) {
          return errorHandler(res, HttpStatus.BAD_REQUEST, "Insufficient balance in wallet.");
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
        await User.findByIdAndUpdate(userId, {
          "wallet.balance": wallet.balance,
          "wallet.transactions": wallet.transactions,
        });

        newOrder.orderPaymentStatus = "Success";
        await finalizeOrder(userId, newOrder, couponId, orderItems);
        req.session.coupon = null;

        return res.status(HttpStatus.OK).json({
          success: true,
          message: `Order placed successfully. Rs.${finalTotalPrice} has been debited from your wallet.`,
          orderId: newOrder._id,
        });

      case "Razorpay":
        const razorpayOrder = await createRazorpayOrder({
          amount: newOrder.totalPrice * 100,
          receipt: `order_rcptid_${userId}`,
        });
        if (!razorpayOrder) {
          return errorHandler(res, HttpStatus.BAD_REQUEST, "Failed to create Razorpay order.");
        }

        newOrder.razorpayOrderId = razorpayOrder.id;
        await newOrder.save();

        return res.status(HttpStatus.OK).json({
          success: true,
          message: "Order created successfully! Proceed with Razorpay payment",
          razorpayOrderId: razorpayOrder.id,
          razorpayKeyId: process.env.RAZORPAY_KEY_ID,
          shippingAddress,
          totalAmount: newOrder.totalPrice,
          user: req.session.user,
        });

      default:
        return errorHandler(res, HttpStatus.BAD_REQUEST, "Invalid payment method.");
    }
  } catch (error) {
    console.error("Order creation failed: ", error);
    throw new Error("An error occurred. Please try again later.");
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

  const isValidSignature = verifyRazorpayPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  if (!isValidSignature) {
    return errorHandler(res, HttpStatus.BAD_REQUEST, "Invalid payment signature.");
  }

  try {
    const order = await confirmRazorpayPayment(
      razorpay_order_id,
      razorpay_payment_id,
      req.session.user._id,
      couponId,
    );

    req.session.coupon = null;

    if (order.orderPaymentStatus === "Success") {
      return res.status(HttpStatus.OK).json({
        success: true,
        message: "Payment verified and order confirmed.",
        order,
      });
    } else {
      return handleRazorpayPaymentFailure(req, res, );
    }
  } catch (error) {
    console.error("Payment confirmation failed: ", error);
    return handleRazorpayPaymentFailure(req, res);
  }
};

//Function to retry Razorpay payment
const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }
    if (order.orderPaymentStatus !== "Failed" && order.orderPaymentStatus !== "Pending") {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Payment already completed.");
    }    

    return res.status(HttpStatus.OK).json({
      success: true,
      razorpayOrderId: order.razorpayOrderId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      totalAmount: order.totalPrice,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Error retrying payment: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Function for retrieving order summary
const getOrderSummary = async (req, res) => {
  const locals = {
    title: "Order Summary | EverGreen",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };

  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("userId")
      .populate("couponId")
      .lean();

    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    res.render("users/orders/orderSummary", {
      locals,
      order: order,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching order summary: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetch and render user's orders
const getUserOrders = async (req, res) => {
  const locals = {
    title: "My Orders | EverGreen",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };
  const userId = req.session.user._id;

  try {
    const page = parseInt(req.query.page || 1);
    const limit = 5;
    const statusFilter = req.query.status || "";
    const skip = (page - 1) * limit;

    let query = { userId };
    if (statusFilter && statusFilter !== "all") {
      query.orderStatus = statusFilter;
    }

    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate("orderItems.productId")
      .populate("userId")
      .populate("couponId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("users/orders/myOrders", {
      locals,
      orders,
      currentPage: page,
      totalPages,
      statusFilter,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching user orders: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetches and renders order details for a specific order
const getOrderDetails = async (req, res) => {
  const locals = {
    title: "Order Summary | EverGreen",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
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
    if (!ObjectId.isValid(orderId)) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Invalid Order ID format.");
    }

    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("userId")
      .populate("couponId")
      .populate("shippingAddress")
      .lean();

    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    const hasNonReturnableItem = order.orderItems.some((item) => nonReturnableStatuses.includes(item.itemStatus));
    const hasNonCancellableItem = order.orderItems.some((item) => nonCancellableStatuses.includes(item.itemStatus));
    const isOrderNonCancellable = nonCancellableStatuses.includes(order.orderStatus);
    const showCancelButton = !hasNonCancellableItem && !isOrderNonCancellable;

    locals.hasNonReturnableItem = hasNonReturnableItem;
    locals.showCancelButton = showCancelButton;

    res.render("users/orders/orderDetails", {
      locals,
      order,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching order details: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Function to handle order cancellation
const cancelOrder = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    const nonCancellableStatuses = [
      "Delivered",
      "Cancelled",
      "Returned",
      "Exchanged",
    ];

    if (nonCancellableStatuses.includes(order.orderStatus)) {
      return errorHandler(
        res,
        HttpStatus.BAD_REQUEST,
        "Order cannot be cancelled as it is already in a non-cancellable state.",
      );
    }

    order.orderStatus = "Cancelled";
    order.orderItems.forEach((item) => item.itemStatus = "Cancelled");

    const refundResult = await processRefund(orderId);
    if (!refundResult.success) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, refundResult.message);
    }

    if (order.couponId) {
      const couponId = order.couponId._id;

      await User.updateOne(
        { _id: order.userId },
        { $pull: { usedCoupons: couponId } },
      );
    }

    await order.save();

    const response = {
      success: true,
      message: "Order has been cancelled successfully.",
    };

    if (refundResult.refundAmount) {
      response.refundAmount = refundResult.refundAmount;
    }

    return res.status(HttpStatus.OK).json(response);
  } catch (error) {
    console.error("Failed to cancel the order: ", error);
    throw new Error("An error occurred. Please try again later.");
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
      return errorHandler(res, HttpStatus.NOT_FOUND, "Item not found.");
    }

    item.returnStatus = "Requested";
    item.returnReason = returnReason;
    item.itemRefundStatus = "Requested";

    await order.save();

    return res.redirect(`/orders/my-orders/order-details/${order._id}?returnRequestSuccess=true`);
  } catch (error) {
    console.error("Error occurred while requesting for return: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Function to generate invoice
const generateInvoice = async (orderId) => {
  const invoicesDir = path.join(__dirname, "..", "invoices");

  try {
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }
  } catch (error) {
    console.error("Error creating invoices directory: ", error);
    throw new Error("An error occurred. Please try again later.");
  }

  const filePath = path.join(invoicesDir, `${orderId}.pdf`);

  try {
    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("shippingAddress")
      .lean();

    const doc = new pdf();
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Add title  to the logo
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
          position,
        )
        .text(`₹${itemAmount.toFixed(2)}`, amountX, position);
      position += 20;
    });

    // Add the total amount
    position += 20;
    doc.fontSize(12).text("Total: ", priceX, position, { align: "left" });
    doc.fontSize(12).text(`₹${totalAmount.toFixed(2)}`, amountX, position, {
      align: "right",
    });

    // Move down before adding additional details
    position += 40;
    doc.moveDown();

    // Add shipping address details
    doc.fontSize(14).text("Shipping Address: ", indexX, position);
    position += 20;
    const address = order.shippingAddress;
    doc.fontSize(12).text(`${address.address}`, indexX, position);
    position += 15;
    doc.text(
      `${address.city}, ${address.state}, ${address.zipCode}`,
      indexX,
      position,
    );

    position += 30;
    doc.fontSize(14).text("Payment Method: ", indexX, position);
    position += 20;
    doc.fontSize(12).text(order.paymentMethod, indexX, position);

    position += 30;
    doc.fontSize(14).text("Payment Status: ", indexX, position);
    position += 20;
    doc.fontSize(12).text(order.orderPaymentStatus, indexX, position);

    // End the PDF document
    doc.end();

    return new Promise((resolve, reject) => {
      writeStream.on("finish", () => {
        console.log(`Invoice generated successfully at ${filePath}.`);
        resolve(filePath);
      });

      writeStream.on("error", (error) => {
        console.error("Error writing PDF to file: ", error);
        reject(new Error("Error generating invoice PDF."));
      });
    });
  } catch (error) {
    console.error("Error generating invoice PDF: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Function to handle invoice download
const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user._id;
    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate("orderItems.productId")
      .populate("shippingAddress")
      .lean();

    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    const filePath = await generateInvoice(order._id);

    // Check if the file was created successfully
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      console.error("Invoice file does not exist: ", filePath);
      throw new Error("An error occurred. Please try again later.");
    }
  } catch (error) {
    console.error("Error generating invoice: ", error);
    throw new Error("An error occurred. Please try again later.");
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