const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    googleId: {
        type: String,
        required: false
    },
    facebookId: {
        type: String,
        required: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    status: {
        type: Boolean,
        default: true
    },
    addresses: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Address'
        }
    ],
    wishlist: {
        type: Schema.Types.ObjectId,
        ref: 'Wishlist'
    },
    cart: {
        type: Schema.Types.ObjectId,
        ref: 'Cart'
    },
    orders: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    usedCoupons: [{
        type: Schema.Types.ObjectId,
        ref: 'Coupon'
    }],
    wallet: {
        balance: {
            type: Number,
            default: 0
        },
        transactions: [
            {
                amount: { type: Number, required: true },
                date: { type: Date, default: Date.now },
                description: { type: String },
                type: {
                    type: String,
                    enum: ['credit', 'debit'],
                    required: true
                },
                status: {
                    type: String,
                    enum: ['pending', 'completed', 'failed'],
                    default: 'completed'
                }
            }
        ]
    },
    referralCode: {
        type: String,
        required: false,
        unique: true
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    referredUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;