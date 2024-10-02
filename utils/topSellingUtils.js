const Order = require("../models/orderSchema"); // Import Order model

// Retrieve top categories based on sold items
const getTopCategories = async () => {
  try {
    const categories = await Order.aggregate([
      { $unwind: "$orderItems" }, // Flatten orderItems array
      { $match: { orderStatus: "Delivered" } }, // Filter delivered orders
      {
        $lookup: {
          from: "products", // Join with products collection
          localField: "orderItems.productId", // Match product ID
          foreignField: "_id",
          as: "productDetails", // Output to productDetails
        },
      },
      { $unwind: "$productDetails" }, // Flatten productDetails
      {
        $group: {
          _id: "$productDetails.category",
          count: { $sum: "$orderItems.quantity" },
        },
      }, // Group by category and count quantities
      { $sort: { count: -1 } }, // Sort by count descending
      { $limit: 5 }, // Limit to top 5 categories
      {
        $lookup: {
          from: "categories", // Join with categories collection
          localField: "_id", // Match category ID
          foreignField: "_id",
          as: "category", // Output to category
        },
      },
      {
        $project: {
          _id: 1, // Include category ID
          count: 1, // Include count
          categoryName: { $arrayElemAt: ["$category.name", 0] }, // Get first category name
        },
      },
    ]);

    return categories; // Return top categories
  } catch (error) {
    console.error("Error fetching top categories:", error); // Log error
    throw error; // Propagate error
  }
};

// Retrieve best-selling products based on sold quantities
const getBestSellingProducts = async () => {
  try {
    const products = await Order.aggregate([
      { $unwind: "$orderItems" }, // Flatten orderItems array
      { $match: { orderStatus: "Delivered" } }, // Filter delivered orders
      {
        $group: {
          _id: "$orderItems.productId",
          count: { $sum: "$orderItems.quantity" },
        },
      }, // Group by product ID and count quantities
      { $sort: { count: -1 } }, // Sort by count descending
      { $limit: 5 }, // Limit to top 5 products
      {
        $lookup: {
          from: "products", // Join with products collection
          localField: "_id", // Match product ID
          foreignField: "_id",
          as: "product", // Output to product
        },
      },
      {
        $project: {
          _id: 1, // Include product ID
          count: 1, // Include count
          productName: { $arrayElemAt: ["$product.name", 0] }, // Get first product name
          productImage: { $arrayElemAt: ["$product.images", 0] }, // Get first product image
        },
      },
    ]);

    return products; // Return best-selling products
  } catch (error) {
    console.error("Error fetching best-selling products:", error); // Log error
    throw error; // Propagate error
  }
};

module.exports = {
  getBestSellingProducts, // Export best-selling products function
  getTopCategories, // Export top categories function
};