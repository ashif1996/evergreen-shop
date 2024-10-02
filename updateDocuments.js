require('dotenv').config(); // Load environment variables

const express = require('express');
const connectDB = require('./config/db');
const User = require('./models/user');
const Order = require('./models/orderSchema');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Function to clear user orders
const clearUserOrders = async () => {
    try {
        const result = await User.updateMany(
            {}, // No filter, so it applies to all users
            { $set: { orders: [] } } // Set the orders array to an empty array
        );
        console.log(`Updated ${result.modifiedCount} users.`);
    } catch (error) {
        console.error('Error clearing user orders:', error);
    }
};

// Function to delete all orders
const deleteAllOrders = async () => {
    try {
        const result = await Order.deleteMany({});
        console.log(`Deleted ${result.deletedCount} orders.`);
    } catch (error) {
        console.error('Error deleting orders:', error);
    }
};

// Run database operations before starting the server
const initializeDatabase = async () => {
    await clearUserOrders();
    await deleteAllOrders();
};

// Start the server after database operations
const startServer = async () => {
    await initializeDatabase();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
};

// Start the application
startServer();