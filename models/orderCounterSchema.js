const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderCounterSchema = new Schema({
    sequence_value: {
        type: Number,
        required: true,
        default: 1,
    }
});
  
const OrderCounter = mongoose.model('OrderCounter', orderCounterSchema);

module.exports = OrderCounter;