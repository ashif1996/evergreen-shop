const Product = require("../models/product");
const Category = require("../models/category");
const Banner = require("../models/bannerSchema");

// Fetches and renders the home page
const getHome = async (req, res) => {
  const locals = {
    title: "EverGreen | Always Fresh", // Page title
    user: req.session.user, // Current user from session
    isLoggedIn: req.session.user ? true : false, // Check if user is logged in
  };

  try {
    const products = await Product.find({}).populate("category"); // Fetch all products with category
    const banners = await Banner.find({ isActive: true }); // Fetch active banners only

    res.render("home", {
      locals,
      products,
      banners, // Pass banners to the view
      layout: "layouts/userLayout", // Use user layout
    });
  } catch (err) {
    console.error(err); // Log error
    res.status(500).send("Server Error"); // Send server error response
  }
};

// Escapes special regex characters in a string
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Sanitizes input by removing special characters
const sanitizeInput = (string) => {
  return string.replace(/[^a-zA-Z0-9\s]/g, "");
};

// Prepares the search term by sanitizing and escaping it
const prepareSearchTerm = async (searchTerm) => {
  const sanitized = sanitizeInput(searchTerm);
  return escapeRegex(sanitized);
};

// Searches for a category by name and returns corresponding products
const searchByCategory = async (searchTerm) => {
  const category = await Category.findOne({
    name: { $regex: searchTerm, $options: "i" }, // Case-insensitive match
  });

  if (category) {
    return Product.find({ category: category._id }); // Return products of found category
  }
  return []; // Return empty array if no category found
};

// Searches products by name or description using escaped search terms
const searchByProduct = async (searchTerm) => {
  const terms = searchTerm.split(" ").map((term) => escapeRegex(term)); // Split and escape terms

  return Product.find({
    $or: [
      { name: { $regex: terms.join("|"), $options: "i" } }, // Match terms in name
      { description: { $regex: terms.join("|"), $options: "i" } }, // Match terms in description
    ],
  });
};

// Main function to handle product search based on search term
const searchProducts = async (req, res) => {
  const locals = {
    title: "EverGreen | Always Fresh",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };
  let searchTerm = req.query.searchTerm || ""; // Get search term from query

  try {
    if (typeof searchTerm !== "string") {
      searchTerm = String(searchTerm); // Convert to string if necessary
    }

    searchTerm = await prepareSearchTerm(searchTerm); // Prepare the search term
    console.log("Search Term:", searchTerm);

    // Search products by category first
    let products = await searchByCategory(searchTerm);

    // If no products found in category, search by product name/description
    if (products.length === 0) {
      products = await searchByProduct(searchTerm);
    }

    // Render the search results page with products
    res.render("searchResults", {
      locals,
      products,
      searchTerm,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error(error); // Log error
    res.status(500).send("Server Error");
  }
};

module.exports = {
  getHome,
  searchProducts,
};