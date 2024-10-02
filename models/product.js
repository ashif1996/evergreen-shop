const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ratingSchema = require('./rating');

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

const productSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: false
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    images: [
        {
            type: String,
            required: true
        }
    ],
    stock: {
        type: Number,
        required: true
    },
    availability: {
        type: Boolean,
        required: true,
        default: true
    },
    offer: {
        type: offerSchema,
        required: false
    },
    ratings: [ratingSchema],
    purchaseCount: {
        type: Number,
        default: 0
    },
    featured: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Virtual field to calculate average rating
productSchema.virtual('averageRating').get(function () {
    if (this.ratings.length === 0) return null; // Return null if no ratings are available

    const totalRating = this.ratings.reduce((sum, rating) => sum + rating.rating, 0);
    return totalRating / this.ratings.length;
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;