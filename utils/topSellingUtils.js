const Order = require("../models/orderSchema");

// Retrieve top categories based on sold items
const getTopCategories = async () => {
  try {
    const categories = await Order.aggregate([
      { $unwind: "$orderItems" },
      { $match: { orderStatus: "Delivered" } },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          count: { $sum: "$orderItems.quantity" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          categoryName: { $arrayElemAt: ["$category.name", 0] },
        },
      },
    ]);

    return categories;
  } catch (error) {
    console.error("Error fetching top categories: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Retrieve best-selling products based on sold quantities
const getBestSellingProducts = async () => {
  try {
    const products = await Order.aggregate([
      { $unwind: "$orderItems" },
      { $match: { orderStatus: "Delivered" } },
      {
        $group: {
          _id: "$orderItems.productId",
          count: { $sum: "$orderItems.quantity" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          productName: { $arrayElemAt: ["$product.name", 0] },
          productImage: { $arrayElemAt: ["$product.images", 0] },
        },
      },
    ]);

    return products;
  } catch (error) {
    console.error("Error fetching best-selling products: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

module.exports = {
  getBestSellingProducts,
  getTopCategories,
};