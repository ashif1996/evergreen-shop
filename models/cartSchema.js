const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cartItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0.50
    },
    itemTotal: {
        type: Number,
        required: true
    }
});

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [cartItemSchema],
    subTotal: {
        type: Number,
        required: true
    },
    shippingCharge: {
        type: Number,
        default: 30
    },
    totalPrice: {
        type: Number,
        required: true
    },
    itemCount: {
        type: Number,
        default: 0
    }
},
{
    timestamps: true
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;