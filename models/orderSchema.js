const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const OrderCounter = require('./orderCounterSchema');

const orderItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    discountedPrice: {
        type: Number,
        required: true,
        default: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 0.50
    },
    itemTotal: {
        type: Number,
        required: true
    },
    itemStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled', 'Returned', 'Exchanged'],
        default: 'Pending'
    },
    returnStatus: {
        type: String,
        enum: ['Requested', 'Received', 'Approved', 'Rejected']
    },
    returnReason: {
        type: String
    },
    returnRejectReason: {
        type: String
    },
    exchangeStatus: {
        type: String,
        enum: ['Requested', 'Pending', 'Approved', 'Rejected', 'Completed']
    },
    exchangeReason: {
        type: String
    },
    exchangeRejectReason: {
        type: String
    },
    itemRefundStatus: {
        type: String,
        enum: ['Requested', 'Pending', 'Completed', 'Rejected']
    },
    itemRefundRejectReason: {
        type: String
    }
});

const orderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    generatedOrderId: {
        type: String,
        required: true
    },
    orderDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    orderStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Failed', 'Cancelled'],
        default: 'Pending'
    },
    orderItems: [orderItemSchema],
    shippingAddress: {
        type: Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'Wallet', 'Razorpay']
    },
    orderPaymentStatus: {
        type: String,
        enum: ['Pending', 'Failed', 'Success', 'Cancelled', 'Refunded'],
        default: 'Pending'
    },
    subTotal: {
        type: Number,
        required: true
    },
    shippingCharge: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    couponId: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon'
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    razorpayOrderId: {
        type: String,
        default: null
    },
    razorpayPaymentId: {
        type: String,
        default: null
    }
},
{
    timestamps: true
});

orderSchema.index({ userId: 1, 'orderItems.productId': 1 });
const Order = mongoose.model('Order', orderSchema);

module.exports = Order;