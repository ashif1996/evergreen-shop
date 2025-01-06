const Banner = require("../models/bannerSchema");
const Category = require("../models/category");
const Product = require("../models/product");

const { calculateBestDiscountedPrice } = require("../utils/discountPriceCalculation");

// Fetches and renders the home page
const getHome = async (req, res) => {
  const locals = {
    title: "EverGreen Home | Always Fresh",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };

  try {
    const banners = await Banner.find({ isActive: true }).lean();
    let products = await Product.find({ availability: true })
      .populate("category")
      .populate("offer")
      .lean();

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

    res.render("home", {
      locals,
      products,
      banners,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("An unexpected error occurred while fetching home: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Escapes special regex characters in a string
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Sanitizes input by removing special characters
const sanitizeInput = (string) => string.replace(/[^a-zA-Z0-9\s]/g, "");

// Prepares the search term by sanitizing and escaping it
const prepareSearchTerm = (searchTerm) => {
  const sanitized = sanitizeInput(searchTerm);
  return escapeRegex(sanitized);
};

// Searches for a category by name and returns corresponding products
const searchByCategory = async (searchTerm) => {
  const category = await Category.findOne({
    name: { $regex: searchTerm, $options: "i" },
  });

  if (category) {
    return await Product.find({ category: category._id });
  }

  return [];
};

// Searches products by name or description using escaped search terms
const searchByProduct = async (searchTerm) => {
  const terms = searchTerm.split(" ").map((term) => escapeRegex(term));

  return await Product.find({
    $or: [
      { name: { $regex: terms.join("|"), $options: "i" } },
      { description: { $regex: terms.join("|"), $options: "i" } },
    ],
  });
};

// Main function to handle product search based on search term
const searchProducts = async (req, res) => {
  const locals = {
    title: "EverGreen Search | Always Fresh",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };

  try {
    let searchTerm = req.query.searchTerm || "";
    if (typeof searchTerm !== "string") {
      searchTerm = String(searchTerm);
    }

    searchTerm = await prepareSearchTerm(searchTerm);

    let products = await searchByCategory(searchTerm);
    if (products.length === 0) {
      products = await searchByProduct(searchTerm);
    }

    res.render("searchResults", {
      locals,
      products,
      searchTerm,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("An error occurred while searching products: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

module.exports = {
  getHome,
  searchProducts,
};