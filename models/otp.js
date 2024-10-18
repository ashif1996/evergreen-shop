const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;

const otpSchema = new Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    otp: {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    }
},{
    timestamps: true,
});

otpSchema.pre('save', function(next) {
    if (!this.isModified('otp')) return next();

    const hash = crypto.createHash('sha256');
    hash.update(this.otp);
    this.otp = hash.digest('hex');
    next();
});

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;