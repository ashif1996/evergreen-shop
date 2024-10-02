const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bannerSchema = new Schema({
    title: {
        type: String,
        required: true, // The title of the banner, e.g., "Summer Sale"
    },
    imageUrl: {
        type: String,
        required: true, // URL of the banner image
    },
    description: {
        type: String, // Optional description for the banner
    },
    isActive: {
        type: Boolean,
        default: true, // Whether the banner is active and should be displayed
    },
    createdAt: {
        type: Date,
        default: Date.now, // Timestamp when the banner was created
    },
    updatedAt: {
        type: Date,
        default: Date.now, // Timestamp when the banner was last updated
    }
});

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;