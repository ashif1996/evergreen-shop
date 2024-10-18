const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const wishlistItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    }
});

const wishlistSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    items: [wishlistItemSchema],
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;