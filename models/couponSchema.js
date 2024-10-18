const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const couponSchema = new Schema({
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
    },
    discountType: {
      type: String,
      enum: ['FIXED', 'PERCENTAGE'],
      default: 'FIXED',
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value must be a positive number'],
    },
    expirationDate: {
      type: Date,
      required: [true, 'Expiration date is required'],
    },
    minimumPurchaseAmount: {
        type: Number,
        default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  { 
    timestamps: true,
});

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;