const Category = require("../models/category");
const Order = require("../models/orderSchema");
const Product = require("../models/product");
const {
  calculateBestDiscountedPrice,
} = require("../utils/discountPriceCalculation");

// Function to get products with offer calculations
const getProducts = async (req, res) => {
  const locals = {
    title: "Products Page",
    isLoggedIn: req.session.user ? true : false,
    user: req.session.user,
    selectedCategory: req.query.categoryId || "0",
    sort: req.query.sort || "",
  };

  const page = parseInt(req.query.page || 1);
  const limit = parseInt(req.query.limit || 10);

  // Retrieve categories that are listed
  const listedCategories = await Category.find({ isListed: true }).select(
    "_id"
  );
  const listedCategoryIds = listedCategories.map((category) => category._id);

  let filter = {
    availability: true,
    category: { $in: listedCategoryIds },
  };

  if (locals.selectedCategory !== "0") {
    filter.category = locals.selectedCategory; // Ensure that the selected category is considered
  }

  let sortOption = {};
  let products = [];
  let totalProducts = 0;

  try {
    const categories = await Category.find({ isListed: true }).populate(
      "offer"
    );

    switch (locals.sort) {
      case "averageRating":
        products = await Product.aggregate([
          { $match: filter },
          { $addFields: { averageRating: { $avg: "$ratings.rating" } } },
          { $sort: { averageRating: -1 } },
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
      case "newArrivals":
        sortOption = { createdAt: -1 };
        break;
      case "discountPrice":
        products = await Product.aggregate([
          { $match: filter },
          {
            $addFields: {
              discountedPrice: {
                $subtract: ["$price", { $ifNull: ["$offer.fixedDiscount", 0] }],
              },
            },
          },
          {
            $addFields: {
              discountedPrice: {
                $subtract: [
                  "$discountedPrice",
                  {
                    $multiply: [
                      "$price",
                      {
                        $divide: [
                          { $ifNull: ["$offer.percentageDiscount", 0] },
                          100,
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          { $sort: { discountedPrice: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ]);
        break;
      case "aToZ":
        sortOption = { name: 1 };
        break;
      case "zToA":
        sortOption = { name: -1 };
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
      case "featured":
        sortOption = { featured: -1 };
        break;
      default:
        sortOption = {};
    }

    if (!products.length) {
      products = await Product.find(filter)
        .populate("category") // Ensure category data is included
        .populate("offer") // Ensure product offer data is included
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit);
    }

    // Ensure product is a Mongoose document before calling toObject
    products = products.map((product) => {
      if (product.toObject) {
        product = product.toObject(); // Convert Mongoose document to a plain object
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

    res.render("users/products/products.ejs", {
      locals,
      categories,
      products,
      totalProducts,
      currentPage: page,
      totalPages,
      csrfToken: req.csrfToken(),
      layout: "layouts/userLayout",
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "An error occurred while fetching products.");
    res.redirect("/");
  }
};

// Function to fetch and render the product details page
const getProductDetails = async (req, res) => {
  const locals = {
    title: "Products Page",
    isLoggedIn: req.session.user ? true : false,
    user: req.session.user,
  };

  try {
    const productId = req.params.id;
    const product = await Product.findById(productId)
      .populate("category")
      .populate("ratings.userId");

    const { discountedPrice, discountPercentage, fixedDiscount, discountType } =
      calculateBestDiscountedPrice(product);
    const mainProduct = {
      ...product.toObject(),
      discountedPrice,
      discountPercentage,
      fixedDiscount,
      discountType,
    };

    // Get the average rating
    const averageRating = product.averageRating;
    const hasRatings = product.ratings.length > 0;

    const relatedCategory = product.category._id;

    // Fetch related products and populate category offers
    let relatedProducts = await Product.find({ category: relatedCategory })
      .populate("category") // Ensure category is populated
      .populate("category.offer"); // Ensure category offer is populated

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

    res.render("users/products/productDetails.ejs", {
      locals,
      product: mainProduct,
      productId,
      averageRating,
      hasRatings,
      relatedProducts,
      layout: "layouts/userLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error fetching product details: ", error);
    res.status(500).send("Internal Server Error");
  }
};

// Function to check if a user is eligible for product review
const isUserEligibleForReview = async (userId, productId) => {
  try {
    // Find if the user has any orders with the product that is delivered
    const order = await Order.findOne({
      userId: userId,
      "orderItems.productId": productId,
      "orderItems.itemStatus": "Delivered",
    })
      .populate({
        path: "orderItems.productId",
        select: "name images", // Retrieve the product name and images array
      })
      .select("_id orderItems.productId"); // Only retrieve the necessary fields

    // If an order is found with the delivered product, user is eligible
    if (order) {
      const product = order.orderItems.find((item) =>
        item.productId._id.equals(productId)
      )?.productId;
      const productName = product?.name;
      const productImage = product?.images?.[0]; // Get the first image from the array
      return { eligible: true, productName, productImage };
    } else {
      return { eligible: false, productName: null, productImage: null };
    }
  } catch (error) {
    console.error("Error checking review eligibility:", error);
    return { eligible: false, productName: null, productImage: null };
  }
};

// Function to render the product rating page
const getRateProduct = async (req, res) => {
  const locals = {
    title: "Products Page",
    isLoggedIn: req.session.user ? true : false,
    user: req.session.user,
  };

  const userId = req.session.user._id;
  const productId = req.params.id;

  try {
    if (!locals.isLoggedIn) {
      const errorMessage =
        "You must be logged in to access this page. Return back to login page.";
      return res.redirect(
        `/error?statusCode=401&errorMessage=${encodeURIComponent(errorMessage)}`
      );
    }

    // Check if the user is eligible to review the product
    const { eligible, productName, productImage } =
      await isUserEligibleForReview(userId, productId);

    if (!eligible) {
      return res.status(200).json({
        eligible: false,
        message: "You are not eligible to review this product.",
      });
    }

    res.status(200).render("users/products/rateProduct.ejs", {
      locals,
      layout: "layouts/userLayout",
      productId,
      productName,
      productImage,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("An internal server error occurred: ", error);
    res.status(500).send("An internal server error occurred");
  }
};

// Function to handle the rating of a product
const rateProduct = async (req, res) => {
  const userId = req.session.user._id; // Get the logged-in user ID
  const productId = req.params.id; // Get the product ID from the route parameters
  const { rating, comment } = req.body; // Extract the rating and comment from the request body

  try {
    // Find the product by ID
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the user has already rated this product
    const existingRating = product.ratings.find(
      (rating) => rating.userId.toString() === userId
    );

    if (existingRating) {
      // If the user has already rated, update the existing rating and review
      existingRating.rating = rating;
      existingRating.review = comment;
    } else {
      // If no existing rating, push a new rating
      product.ratings.push({
        userId,
        rating,
        review: comment,
      });
    }

    // Save the updated product with the new/updated rating
    await product.save();

    // Respond with a success message
    res.status(201).json({ message: "Review submitted successfully!" });
  } catch (error) {
    console.error("Error saving review: ", error);
    res
      .status(500)
      .json({ message: "An error occurred while submitting your review." });
  }
};

module.exports = {
  getProducts,
  getProductDetails,
  getRateProduct,
  rateProduct,
};