const Order = require("../models/orderSchema");

// Retrieve top categories based on sold items
const getTopCategories = async (next) => {
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
  } catch (err) {
    console.error("Error fetching top categories: ", err);
    return next(err);
  }
};

// Retrieve best-selling products based on sold quantities
const getBestSellingProducts = async (next) => {
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
  } catch (err) {
    console.error("Error fetching best-selling products: ", err);
    return next(err);
  }
};

module.exports = {
  getBestSellingProducts,
  getTopCategories
};