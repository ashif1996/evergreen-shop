const mongoose = require('mongoose');
const Category = require("../models/category");
const Order = require("../models/orderSchema");
const Product = require("../models/product");
const { calculateBestDiscountedPrice } = require("../utils/discountPriceCalculation");
const errorHandler = require("../utils/errorHandlerUtils");
const successHandler = require("../utils/successHandlerUtils");
const HttpStatus = require("../utils/httpStatus");

// Function to get products with offer calculations
const getProducts = async (req, res, next) => {
  const locals = {
    title: "Products Page",
    isLoggedIn: !!req.session.user,
    user: req.session.user,
    selectedCategory: req.query.categoryId || "0",
    sort: req.query.sort || "",
  };

  const page = parseInt(req.query.page || 1);
  const limit = parseInt(req.query.limit || 10);

  try {
    const categories = await Category.find({ isListed: true }).populate("offer");
    const listedCategoryIds = categories.map((category) => category._id);

    let filter = {
      availability: true,
      category: { $in: listedCategoryIds },
    };

    if (locals.selectedCategory !== "0") {
      filter.category = locals.selectedCategory;
    }

    let sortOption = {};
    let products = [];
    let totalProducts = 0;

    switch (locals.sort) {
      case "aToZ":
        sortOption = { name: 1 };
        break;
      case "zToA":
        sortOption = { name: -1 };
        break;
      case "averageRating":
        products = await Product.aggregate([
          { $match: filter },
          { $addFields: { averageRating: { $avg: "$ratings.rating" } } },
          { $sort: { averageRating: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ]);
        break;
      case "newArrivals":
        sortOption = { createdAt: -1 };
        break;
      case "popularity":
        products = await Product.aggregate([
          { $match: filter },
          {
            $addFields: {
              popularityScore: {
                $add: [
                  { $multiply: ["$purchaseCount", 0.7] },
                  { $avg: "$ratings.rating" },
                ],
              },
            },
          },
          { $sort: { popularityScore: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ]);
        break;
      case "priceLowToHigh":
        sortOption = { price: 1 };
        break;
      case "priceHighToLow":
        sortOption = { price: -1 };
        break;
      case "featured":
        sortOption = { featured: -1 };
        break;
      default:
        sortOption = {};
    }    

    if (products.length === 0) {
      products = await Product.find(filter)
        .populate({
          path: "category", 
          populate: { path: "offer" },
        })
        .populate("offer")
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit);
    }

    products = products.map((product) => {
      if (product.toObject) {
        product = product.toObject();
      }
      const {
        discountedPrice,
        discountPercentage,
        fixedDiscount,
        discountType,
      } = calculateBestDiscountedPrice(product);
      return {
        ...product,
        discountedPrice,
        discountPercentage,
        fixedDiscount,
        discountType,
      };
    });

    totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    return res.render("users/products/products", {
      locals,
      categories,
      products,
      totalProducts,
      currentPage: page,
      totalPages,
      layout: "layouts/userLayout",
    });
  } catch (err) {
    console.error("An error occurred while fetching the products page: ", err);
    return next(err);
  }
};

// Function to validate if an ID is a valid MongoDB ObjectID
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Function to fetch and render the product details page
const getProductDetails = async (req, res, next) => {
  const locals = {
    title: "Product Details | EverGreen",
    isLoggedIn: !!req.session.user,
    user: req.session.user,
  };

  try {
    const productId = req.params.id;
    if (!isValidObjectId(productId)) {
      return res.status(HttpStatus.BAD_REQUEST).render('notFoundError', {
          message: 'Invalid product ID.',
          layout: 'layouts/errorMessagesLayout',
      });
    }

    const product = await Product.findById(productId)
      .populate({
        path: "category", 
        populate: { path: "offer" },
      })
      .populate("ratings.userId");

    if (!product) {
      return res.status(404).render('notFoundError', {
        message: 'Product not found.',
        layout: 'layouts/errorMessagesLayout',
      });
    }

    const { discountedPrice, discountPercentage, fixedDiscount, discountType } = calculateBestDiscountedPrice(product);
    const mainProduct = {
      ...product.toObject(),
      discountedPrice,
      discountPercentage,
      fixedDiscount,
      discountType,
    };

    const averageRating = product.averageRating;
    const hasRatings = product.ratings.length > 0;
    const relatedCategory = product.category._id;

    let relatedProducts = await Product.find({ category: relatedCategory })
      .limit(5)
      .populate({
        path: "category", 
        populate: { path: "offer" }
      });

    relatedProducts = relatedProducts.map((relatedProduct) => {
      const {
        discountedPrice,
        discountPercentage,
        fixedDiscount,
        discountType,
      } = calculateBestDiscountedPrice(relatedProduct);
      return {
        ...relatedProduct.toObject(),
        discountedPrice,
        discountPercentage,
        fixedDiscount,
        discountType,
      };
    });

    return res.render("users/products/productDetails", {
      locals,
      product: mainProduct,
      productId,
      averageRating,
      hasRatings,
      relatedProducts,
      layout: "layouts/userLayout",
    });
  } catch (err) {
    console.error('Error fetching product details: ', err);
    return next(err);
  }
};

// Function to check if a user is eligible for product review
const isUserEligibleForReview = async (userId, productId, next) => {
  try {
    const order = await Order.findOne({
      userId: userId,
      "orderItems.productId": productId,
      "orderItems.itemStatus": "Delivered",
    })
      .populate({
        path: "orderItems.productId",
        select: "name images",
      })
      .select("_id orderItems.productId");

    if (order) {
      const productItem = order.orderItems.find(item => item.productId._id.equals(productId));
    
      if (productItem) {
        return {
          eligible: true,
          productName: productItem.productId.name,
          productImage: productItem.productId.images?.[0] || null,
        };
      }
    }
    
    return { eligible: false, productName: null, productImage: null };      
  } catch (err) {
    console.error("An error occurred checking review eligibility: ", err);
    return next(err);
  }
};

// Function to render the product rating page
const getRateProduct = async (req, res, next) => {
  const locals = {
    title: "Products Page",
    isLoggedIn: !!req.session.user,
    user: req.session.user,
  };

  const userId = req.session.user._id;
  const productId = req.params.id;

  try {
    const { eligible, productName, productImage } = await isUserEligibleForReview(userId, productId);

    if (!eligible) {
      return errorHandler(res, HttpStatus.FORBIDDEN, "You are not eligible to review this product.");
    }

    return res.render("users/products/rateProduct", {
      locals,
      layout: "layouts/userLayout",
      productId,
      productName,
      productImage,
    });
  } catch (err) {
    console.error("Error fetching product rating page: ", err);
    return next(err);
  }
};

// Function to handle the rating of a product
const rateProduct = async (req, res, next) => {
  const userId = req.session.user._id;
  const productId = req.params.id;
  const { rating, comment } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found");
    }

    const existingRating = product.ratings.find((rating) => rating.userId.toString() === userId);
    if (existingRating) {
      existingRating.rating = rating;
      existingRating.review = comment;
    } else {
      product.ratings.push({
        userId,
        rating,
        review: comment,
      });
    }

    await product.save();

    return successHandler(res, HttpStatus.CREATED, "Review submitted successfully.");
  } catch (err) {
    console.error("Error submitting the review: ", err);
    return next(err);
  }
};

module.exports = {
  getProducts,
  getProductDetails,
  getRateProduct,
  rateProduct,
};