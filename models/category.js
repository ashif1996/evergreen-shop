const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const offerSchema = new Schema({
    type: {
        type: String, // e.g., 'Seasonal', 'Flash Sale', 'BOGO', etc.
        required: false
    },
    fixedDiscount: {
        type: Number,
        required: false,
        default: 0
    },
    percentageDiscount: {
        type: Number,
        required: false,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: false
    },
    minimumPurchaseAmount: {
        type: Number, // e.g., minimum amount to apply the offer
        required: false,
        default: 0 // or whatever default value you prefer
    },
    expirationDate: {
        type: Date,
        required: false
    }
});

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        default: 'Active'
    },
    description: {
        type: String,
        required: false
    },
    isListed: {
        type: Boolean,
        default: true
    },
    offer: {
        type: offerSchema,
        required: false
    }
}, {
    timestamps: true
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;