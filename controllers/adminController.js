const path = require("path");
const bcrypt = require("bcrypt");
const Admin = require("../models/admin");
const User = require("../models/user");
const Category = require("../models/category");
const Product = require("../models/product");
const Coupon = require("../models/couponSchema");
const Order = require("../models/orderSchema");
const Banner = require("../models/bannerSchema");
const { getDateRange } = require("../utils/chartUtils");
const topSelling = require("../utils/topSellingUtils");
const { processRefund } = require("../utils/paymentServices/walletServices");

// Render the admin login page
const getAdminLogin = (req, res) => {
  const locals = { title: "Admin Log in | EverGreen" }; // Local variables for the view

  if (req.session && req.session.admin) {
    res.redirect("/admin/dashboard"); // Redirect if already logged in
  } else {
    res.status(200).render("admin/login.ejs", {
      locals, // Pass locals to the view
      layout: "layouts/authLayout.ejs", // Use the authentication layout
      csrfToken: req.csrfToken(), // CSRF token for security
    });
  }
};

// Handle admin login
const adminLogin = async (req, res) => {
  const locals = { title: "Admin Log in | EverGreen", message: {} };
  const { email, password } = req.body; // Extract email and password from request

  try {
    const admin = await Admin.findOne({ email, isAdmin: true }); // Find admin by email

    if (!admin) {
      locals.message.error = "Admin not found. Try another account."; // Error message for non-existent admin

      // Render login page with error
      return res.status(404).render("admin/login.ejs", {
        locals,
        layout: "layouts/authLayout.ejs",
        csrfToken: req.csrfToken(),
      });
    }

    const validatePassword = await bcrypt.compare(password, admin.password); // Validate password

    if (!validatePassword) {
      locals.message.error = "Incorrect password. Try again."; // Error message for wrong password

      // Render login page with error
      return res.status(400).render("admin/login.ejs", {
        locals,
        layout: "layouts/authLayout.ejs",
        csrfToken: req.csrfToken(),
      });
    }

    // Set admin session data
    req.session.admin = {
      _id: admin._id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      isAdmin: admin.isAdmin,
    };

    res.redirect("/admin/dashboard"); // Redirect to dashboard
  } catch (err) {
    console.error("Unexpected error: ", err); // Log error

    locals.message.error = "An error occurred. Try again later."; // Error message for unexpected issues

    // Render login page with error
    return res.status(500).render("admin/login.ejs", {
      locals,
      layout: "layouts/authLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Handle fetching and rendering the Admin dashboard
const getDashboard = async (req, res) => {
  const locals = { title: "Admin Dashboard | EverGreen", message: {} };

  try {
    // Fetch essential data for the dashboard
    const totalUsers = await User.countDocuments(); // Total users
    const totalProducts = await Product.countDocuments(); // Total products
    const totalOrders = await Order.countDocuments({
      orderStatus: "Delivered",
    }); // Delivered orders count
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: "Delivered" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    // Render dashboard view with fetched data
    return res.render("admin/dashboard.ejs", {
      locals,
      layout: "layouts/adminLayout.ejs",
      admin: req.session.admin,
      topCategories: await topSelling.getTopCategories(),
      bestsellingProducts: await topSelling.getBestSellingProducts(),
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0, // Default to 0 if no data
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);

    // Handle AJAX requests with a JSON response
    if (req.xhr) {
      return res.status(500).json({ error: "Server error" });
    }

    // Handle standard HTML error response
    return res.status(500).send("Server error");
  }
};

// Function for product order analysis
const getProductOrderAnalysis = async (dateRange, filterDate) => {
  const { startDate, endDate } = getDateRange(dateRange, filterDate);

  const orders = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate, $lt: endDate } } }, // Filter by date range
    { $unwind: "$orderItems" }, // Flatten orderItems array
    {
      $lookup: {
        from: "products",
        localField: "orderItems.productId", // Match productId in orderItems
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: "$productDetails" }, // Flatten productDetails array
    {
      $group: {
        _id: "$productDetails.name", // Group by product name
        totalQuantity: { $sum: "$orderItems.quantity" }, // Sum quantities
      },
    },
    { $sort: { totalQuantity: -1 } }, // Sort by quantity (desc)
    { $limit: 10 }, // Limit to top 10 products
  ]);

  const labels = orders.map((order) => order._id); // Extract product names
  const data = orders.map((order) => order.totalQuantity); // Extract quantities

  return { labels, orders: data };
};

// Function for category order analysis
const getCategoryOrderAnalysis = async (dateRange, filterDate) => {
  const { startDate, endDate } = getDateRange(dateRange, filterDate);

  const orders = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate, $lt: endDate } } }, // Filter by date range
    { $unwind: "$orderItems" }, // Flatten orderItems array
    {
      $lookup: {
        from: "products",
        localField: "orderItems.productId", // Match productId
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: "$productDetails" }, // Flatten productDetails array
    {
      $lookup: {
        from: "categories",
        localField: "productDetails.category", // Match category
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    { $unwind: "$categoryDetails" }, // Flatten categoryDetails array
    {
      $group: {
        _id: "$categoryDetails.name", // Group by category
        totalQuantity: { $sum: "$orderItems.quantity" }, // Sum quantities
      },
    },
    { $sort: { totalQuantity: -1 } }, // Sort by quantity (desc)
    { $limit: 10 }, // Top 10 categories
  ]);

  const labels = orders.map((order) => order._id); // Extract category names
  const data = orders.map((order) => order.totalQuantity); // Extract quantities

  return { labels, orders: data };
};

// Retrieves chart data for products or categories based on filter type
const getChart = async (req, res) => {
  const { filterType, dateRange, filterDate } = req.query;

  console.log(
    `Received request for filterType=${filterType}, dateRange=${dateRange}, filterDate=${filterDate}`
  );

  try {
    let data;
    if (filterType === "products") {
      data = await getProductOrderAnalysis(dateRange, filterDate); // Get product data
    } else {
      data = await getCategoryOrderAnalysis(dateRange, filterDate); // Get category data
    }

    console.log("Sending data:", data);
    res.json(data);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Fetch and render categories page
const getCategories = async (req, res) => {
  const locals = { title: "Admin Categories | EverGreen", message: {} };

  try {
    const categories = await Category.find().lean(); // Get categories

    res.status(200).render("admin/categories.ejs", {
      categories,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error fetching categories:", err);

    locals.message.error = "Error fetching categories. Please try again later.";

    res.status(500).render("admin/categories.ejs", {
      locals,
      categories: [],
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Add or update a category
const addCategory = async (req, res) => {
  const { categoryId, categoryName, status, description } = req.body;

  try {
    // Update category if categoryId is provided
    if (categoryId) {
      await Category.findByIdAndUpdate(categoryId, {
        name: categoryName,
        status,
        description,
      });

      return res.status(200).json({
        success: true,
        message: `${categoryName} category updated successfully.`,
      });
    } else {
      // Check if category exists (case-insensitive)
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, "i") },
      });

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: `${categoryName} category already exists.`,
        });
      }

      // Create and save new category
      const newCategory = new Category({
        name: categoryName,
        status,
        description,
      });
      await newCategory.save();

      return res.status(200).json({
        success: true,
        message: `${newCategory.name} category added successfully.`,
      });
    }
  } catch (err) {
    console.error("Error creating category:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Error creating category. Please try again later.",
      });
  }
};

// Toggle category listing status
const toggleCategoryListing = async (req, res) => {
  const categoryId = req.params.id;

  try {
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category not found. Please try again.`,
      });
    }

    // Toggle listing status and save
    category.isListed = !category.isListed;
    await category.save();

    return res.status(200).json({
      success: true,
      message: `${category.name} ${
        category.isListed ? "listed" : "unlisted"
      } successfully`,
    });
  } catch (err) {
    console.error("Error toggling category listing: ", err);

    return res.status(500).json({
      success: false,
      message: `Error toggling category listing. Please try again later.`,
    });
  }
};

// Get list of users
const getUsers = async (req, res) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };

  try {
    const users = await User.find().lean(); // Fetch users

    // Render Users page
    res.status(200).render("admin/users.ejs", {
      locals,
      users,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error fetching users: ", err);

    locals.message.error = "Error fetching users. Please try again later.";

    // Render Users page with error
    res.status(500).render("admin/users.ejs", {
      locals,
      users: [],
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Block a user
const blockUser = async (req, res) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };
  const userId = req.params.userId;
  let users = [];

  try {
    const user = await User.findById(userId); // Find user by ID
    users = await User.find().lean(); // Fetch users

    // If user not found, show error
    if (!user) {
      locals.message.error = "User not found!";
      return res.status(404).render("admin/users.ejs", {
        locals,
        users,
        layout: "layouts/adminLayout.ejs",
        csrfToken: req.csrfToken(),
      });
    }

    // Block user
    user.status = false;
    await user.save();

    locals.message.success = `${user.firstName} ${user.lastName} has been blocked successfully`;

    // Fetch updated users list
    users = await User.find();
    res.status(200).render("admin/users.ejs", {
      locals,
      users,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error blocking the user:", err);

    locals.message.error = "Error blocking the user. Please try again later.";
    res.status(500).render("admin/users.ejs", {
      locals,
      users,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Unblock a user
const unblockUser = async (req, res) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };
  const userId = req.params.userId;
  let users = [];

  try {
    const user = await User.findById(userId); // Find user by ID
    users = await User.find(); // Fetch users

    // If user not found, show error
    if (!user) {
      locals.message.error = "User not found!";
      return res.status(404).render("admin/users.ejs", {
        locals,
        users,
        layout: "layouts/adminLayout.ejs",
        csrfToken: req.csrfToken(),
      });
    }

    // Unblock user
    user.status = true;
    await user.save();

    locals.message.success = `${user.firstName} ${user.lastName} has been unblocked successfully`;

    // Fetch updated users list
    users = await User.find();
    res.status(200).render("admin/users.ejs", {
      locals,
      users,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error unblocking the user:", err);

    locals.message.error = "Error unblocking the user. Please try again later.";
    res.status(500).render("admin/users.ejs", {
      locals,
      users,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Fetch and render the products
const getProducts = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };

  try {
    const products = await Product.find().lean(); // Get products
    const categories = await Category.find().lean(); // Get categories

    // Render the Products page
    res.status(200).render("admin/products.ejs", {
      locals,
      products,
      categories,
      layout: "layouts/adminLayout.ejs",
    });
  } catch (err) {
    console.error(`Error fetching categories or products:`, err);

    locals.message.error =
      "Error fetching categories or products. Please try again later.";

    // Render the Products page with error message and empty arrays
    res.status(500).render("admin/products.ejs", {
      locals,
      products: [],
      categories: [],
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Fetch and render the add product page
const getAddProduct = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };

  try {
    const categories = await Category.find({ isListed: true }); // Get listed categories

    // Render the add product page
    res.status(200).render("admin/addProduct.ejs", {
      locals,
      categories,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error fetching categories:", err);

    locals.message.error = "Error fetching categories. Please try again later.";

    // Render the add product page with error message and empty categories
    res.status(500).render("admin/addProduct.ejs", {
      locals,
      categories: [],
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Add a new product to the database
const addProduct = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };

  try {
    const {
      name,
      description,
      price,
      discountPrice,
      category,
      stock,
      availability,
      featured,
      redirectUrl,
    } = req.body;
    let images = req.files;

    // Ensure images is an array
    if (!Array.isArray(images)) {
      images = [images];
    }

    // Get image file paths
    const imagePaths = images.map((file) => file.filename);

    // Check for existing product
    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: `${name} already exists.`,
        originalUrl: req.originalUrl,
      });
    }

    // Create and save the new product
    const newProduct = new Product({
      name,
      description,
      price,
      discountPrice,
      category,
      images: imagePaths,
      stock,
      availability: availability === "true",
      featured: featured === "on",
    });

    await newProduct.save();

    res.status(200).json({
      success: true,
      product: newProduct,
      message: `${newProduct.name} added successfully`,
      redirectUrl,
    });
  } catch (error) {
    console.error("Error adding the product: ", error);

    res.status(500).json({
      success: false,
      message: "Error adding the product. Please try again later.",
    });
  }
};

// Fetch product details for editing
const getEditProduct = async (req, res) => {
  const locals = { title: "Admin - Edit Products | EverGreen", message: {} };
  try {
    // Get listed categories and product ID
    const categories = await Category.find({ isListed: true });
    const productId = req.params.id;
    const product = await Product.findById(productId);

    // Check if product exists
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found!",
        originalUrl: req.originalUrl,
      });
    }

    // Render the edit product page
    res.status(200).render("admin/editProduct.ejs", {
      locals,
      categories,
      product,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error fetching the product: ", err);

    res.status(500).json({
      success: false,
      message: "Error fetching the product. Please try again later.",
    });
  }
};

// Update product details
const editProduct = async (req, res) => {
  try {
    // Extract product details and ID from request
    const {
      name,
      description,
      price,
      discountPrice,
      category,
      stock,
      availability,
      featured,
      redirectUrl,
    } = req.body;
    const productId = req.params.id;
    let images = req.files;

    // Ensure images is an array
    if (!Array.isArray(images) && images) {
      images = [images];
    }

    const product = await Product.findById(productId);

    // Check if product exists
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
        originalUrl: req.originalUrl,
      });
    }

    // Handle image uploads or retain existing ones
    let imagePaths =
      images && images.length > 0
        ? images.map((file) => file.filename)
        : product.images; // Keep existing images if none provided

    const updateProduct = {
      name,
      description,
      price,
      discountPrice,
      category,
      stock,
      availability: availability === "true",
      images: imagePaths,
      featured: featured === "on",
    };

    // Update product in the database
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateProduct,
      { new: true }
    );

    res.status(200).json({
      success: true,
      updatedProduct,
      message: `${updateProduct.name} updated successfully`,
      redirectUrl,
    });
  } catch (err) {
    console.error("Error updating the product:", err);
    res
      .status(500)
      .json({ success: false, message: "Error updating the product!" });
  }
};

// List a product as available
const listProduct = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };
  const productId = req.params.productId;
  let products = [];

  try {
    const product = await Product.findById(productId);
    products = await Product.find();

    // Check if product exists
    if (!product) {
      locals.message.error = "Product not found! Please try again.";

      // Render products page with error message
      return res.status(404).render("admin/products.ejs", {
        locals,
        products,
        layout: "layouts/adminLayout.ejs",
        csrfToken: req.csrfToken(),
      });
    }

    // Update product availability
    product.availability = true;
    await product.save();

    locals.message.success = `${product.name} listed successfully`;

    // Fetch and render updated product list
    products = await Product.find();
    return res.status(200).render("admin/products.ejs", {
      locals,
      products,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error listing the product:", err);

    locals.message.error =
      "Error listing the product. Please try again later or contact support.";

    // Render products page with error message
    return res.status(500).render("admin/products.ejs", {
      locals,
      products,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Unlist a product by setting its availability to false
const unlistProduct = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };
  const productId = req.params.productId;
  let products = [];

  try {
    const product = await Product.findById(productId);
    products = await Product.find();

    // Check if product exists
    if (!product) {
      locals.message.error = "Product not found! Please try again.";

      // Render products page with error message
      return res.status(404).render("admin/products.ejs", {
        locals,
        products,
        layout: "layouts/adminLayout.ejs",
        csrfToken: req.csrfToken(),
      });
    }

    // Update product availability
    product.availability = false;
    await product.save();

    locals.message.success = `${product.name} unlisted successfully`;

    // Fetch and render updated product list
    products = await Product.find();
    return res.status(200).render("admin/products.ejs", {
      locals,
      products,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error unlisting the product:", err);

    locals.message.error =
      "Error unlisting the product. Please try again later or contact support.";

    // Render products page with error message
    return res.status(500).render("admin/products.ejs", {
      locals,
      products,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  }
};

// Render the add coupon page
const getAddCoupon = (req, res) => {
  res.render("admin/addCoupon.ejs", {
    layout: "layouts/adminLayout",
    csrfToken: req.csrfToken(),
  });
};

// Adds a new coupon to the database
const addCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minimumPurchaseAmount,
      expirationDate,
      isActive,
    } = req.body;

    // Create a new coupon
    const newCoupon = new Coupon({
      code,
      discountType,
      discountValue,
      minimumPurchaseAmount,
      expirationDate,
      isActive: isActive ? true : false,
    });

    await newCoupon.save();

    // Send JSON response for client-side handling
    res
      .status(200)
      .json({ success: true, message: "Coupon added successfully" });
  } catch (error) {
    console.error(error);
    // Send JSON response for client-side handling
    res.status(400).json({ success: false, message: error.message });
  }
};

// Retrieves and displays all coupons
const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({});

    res.render("admin/coupons.ejs", {
      coupons,
      layout: "layouts/adminLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error(error);
    req.flash("error_msg", error.message); // Flash error message
    res.redirect("/admin/dashboard"); // Redirect on error
  }
};

// Retrieves and displays a coupon for editing
const getEditCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    res.render("admin/editCoupon.ejs", {
      coupon,
      layout: "layouts/adminLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error(error);
    req.flash("error_msg", error.message); // Flash error message
    res.redirect("/admin/coupons"); // Redirect on error
  }
};

// Updates a coupon based on provided data
const editCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minimumPurchaseAmount,
      expirationDate,
      isActive,
    } = req.body;

    // Update the coupon in the database
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        code,
        discountType,
        discountValue,
        minimumPurchaseAmount,
        expirationDate,
        isActive: isActive ? true : false,
      },
      { new: true } // Return the updated document
    );

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message }); // Handle error
  }
};

// Toggles the active status of a coupon
const toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    coupon.isActive = !coupon.isActive; // Toggle the status
    await coupon.save(); // Save changes to the database

    res.status(200).json({
      success: true,
      message: `Coupon ${
        coupon.isActive ? "activated" : "deactivated"
      } successfully`,
      coupon,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message }); // Handle error
  }
};

// Fetches and renders the list of orders
const getOrders = async (req, res) => {
  const locals = { title: "Admin - Orders List | EverGreen", message: {} };

  try {
    const orders = await Order.find().populate("userId").populate("couponId"); // Retrieve orders with user and coupon details

    res.render("admin/orders.ejs", {
      locals,
      orders,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("Error fetching orders:", error); // Log error
    res.status(500).send("Server Error"); // Handle error
  }
};

// Updates the status of an order
const updateOrderStatus = async (req, res) => {
  const { orderStatus } = req.body; // Extract order status from request body
  const { id } = req.params; // Extract order ID from request parameters

  try {
    const order = await Order.findById(id); // Find the order by ID

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." }); // Handle order not found
    }

    order.orderStatus = orderStatus; // Update order status
    // Set payment status to 'Success' for COD orders when delivered
    if (order.paymentMethod === "COD" && order.orderStatus === "Delivered") {
      order.orderPaymentStatus = "Success";
    }
    await order.save(); // Save the updated order

    res
      .status(200)
      .json({
        success: true,
        message: `Order status changed to ${orderStatus}.`,
      }); // Respond with success
  } catch (error) {
    console.error("Error changing order status: ", error); // Log error
    res.status(500).json({ success: false, message: error.message }); // Handle error
  }
};

// Fetches and displays order details
const getOrderDetails = async (req, res) => {
  const locals = {
    title: "Admin Order Details | EverGreen", // Page title
  };

  try {
    const { orderId } = req.params; // Extract order ID from request parameters
    const order = await Order.findById(orderId) // Find order by ID
      .populate("orderItems.productId") // Populate product details
      .populate("couponId") // Populate coupon details
      .populate("shippingAddress"); // Populate shipping address

    // Check if order was found
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." }); // Handle order not found
    }

    // Render order details page
    res.status(200).render("admin/orderDetails.ejs", {
      locals,
      order,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching order details: ", error); // Log error
    res
      .status(500)
      .render("error", { message: "Failed to load order details." }); // Handle error
  }
};

// Updates the status of an item in an order
const updateItemStatus = async (req, res) => {
  const { orderId, itemId } = req.params; // Extract order and item IDs from parameters
  const { itemStatus } = req.body; // Get new item status from request body

  try {
    const order = await Order.findById(orderId).populate(
      "orderItems.productId"
    ); // Find order by ID
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found!" }); // Handle order not found
    }

    const item = order.orderItems.id(itemId); // Find item by ID
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found!" }); // Handle item not found
    }

    item.itemStatus = itemStatus; // Update item status
    await order.save(); // Save the updated order

    // Respond with success message and updated item
    res.status(200).json({
      success: true,
      message: `${item.productId.name} status has been updated to ${itemStatus}`,
      updatedItem: item,
    });
  } catch (error) {
    console.error("Error updating item status:", error); // Log error
    res
      .status(500)
      .json({ message: "An error occurred while updating item status" }); // Handle error
  }
};

// Fetches and renders the banner page for admin
const getBanner = async (req, res) => {
  const locals = {
    title: "Admin Banner Page | EverGreen", // Set page title
  };

  try {
    const banners = await Banner.find({}); // Retrieve all banners
    res.render("admin/banners.ejs", {
      locals,
      banners,
      layout: "layouts/adminLayout", // Render with admin layout
      csrfToken: req.csrfToken(), // Include CSRF token
    });
  } catch (error) {
    console.error(error); // Log error
    res.redirect("/admin/dashboard"); // Redirect to dashboard on error
  }
};

// Renders the add banner page for admin
const getAddBanner = (req, res) => {
  res.render("admin/addBanner.ejs", {
    layout: "layouts/adminLayout", // Use admin layout
    csrfToken: req.csrfToken(), // Include CSRF token
  });
};

// Adds a new banner to the database
const addBanner = async (req, res) => {
  try {
    const { title, description, isActive } = req.body;
    const image = req.file;

    // Check for uploaded image
    if (!image) {
      return res
        .status(400)
        .json({ success: false, message: "No image uploaded." });
    }

    const imageUrl = image.filename; // Get the image filename

    const newBanner = new Banner({
      title,
      imageUrl,
      description,
      isActive: isActive === "on", // Set active status based on checkbox
    });

    await newBanner.save(); // Save the new banner
    res.json({ success: true, banner: newBanner }); // Respond with success
  } catch (error) {
    console.error("Error adding banner:", error);
    res.status(500).send("Server Error"); // Handle server errors
  }
};

// Updates an existing banner in the database
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params; // Get banner ID from request parameters
    const { title, description, isActive } = req.body; // Extract fields from request body
    const image = req.file; // Get uploaded image

    const updateData = { title, description, isActive }; // Prepare update data
    if (image) {
      updateData.imageUrl = image.filename; // Update imageUrl if a new image is uploaded
    }

    const updatedBanner = await Banner.findByIdAndUpdate(id, updateData, {
      new: true, // Return the updated document
    });

    if (!updatedBanner) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found." }); // Handle banner not found
    }

    res.json({
      // Respond with success
      success: true,
      message: "Banner updated successfully.",
      banner: updatedBanner,
    });
  } catch (error) {
    console.error("Error updating banner:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while updating banner." }); // Handle server errors
  }
};

// Delete a banner
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBanner = await Banner.findByIdAndDelete(id);

    if (!deletedBanner) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found." });
    }

    // Optionally, remove the banner image from the file system
    if (deletedBanner.imageUrl) {
      fs.unlink(path.join("public", deletedBanner.imageUrl), (err) => {
        if (err) console.error("Error deleting banner image:", err);
      });
    }

    res.json({ success: true, message: "Banner deleted successfully." });
  } catch (error) {
    console.error("Error deleting banner:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while deleting banner." });
  }
};

// Renders the add category offers page
const getAddCategoryOffers = async (req, res) => {
  const offerTypes = [
    // List of offer types
    "Seasonal",
    "Flash Sale",
    "Weekend Special",
    "Festive Discount",
    "Clearance Sale",
  ];

  try {
    const categories = await Category.find({ isListed: true }); // Fetch listed categories
    if (!categories) {
      return res
        .status(404)
        .json({ success: false, message: "Categories not found." }); // Handle no categories found
    }

    res.status(200).render("admin/addCategoryOffer.ejs", {
      // Render the page with categories and offer types
      categories,
      offerTypes,
      layout: "layouts/adminLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("An internal error occurred: ", error);
    res.status(500).json({ message: "An internal error occurred" }); // Handle internal server error
  }
};

// Adds an offer to a specified category
const addCategoryOffers = async (req, res) => {
  const {
    category,
    offerType,
    fixedDiscount,
    percentageDiscount,
    offerIsActive,
    minimumPurchaseAmount,
    offerExpirationDate,
  } = req.body;

  try {
    const categoryToUpdate = await Category.findOne({ name: category }); // Find the category by name
    if (!categoryToUpdate) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" }); // Handle category not found
    }

    // Set offer details
    categoryToUpdate.offer = {
      type: offerType,
      fixedDiscount: fixedDiscount ? parseFloat(fixedDiscount) : 0,
      percentageDiscount: percentageDiscount
        ? parseFloat(percentageDiscount)
        : 0,
      minimumPurchaseAmount: minimumPurchaseAmount
        ? parseFloat(minimumPurchaseAmount)
        : 0,
      isActive: offerIsActive === "true",
      expirationDate: offerExpirationDate
        ? new Date(offerExpirationDate)
        : null,
    };

    await categoryToUpdate.save(); // Save updated category

    res.status(200).json({
      // Respond with success message
      success: true,
      message: `${categoryToUpdate.offer.type} offer added to ${categoryToUpdate.name}.`,
    });
  } catch (error) {
    console.error("An internal error occurred: ", error);
    res.status(500).json({ message: "An internal error occurred" }); // Handle internal server error
  }
};

// Retrieves products for adding offers
const getAddProductOffers = async (req, res) => {
  const offerTypes = [
    "Seasonal",
    "Flash Sale",
    "Weekend Special",
    "Festive Discount",
    "Clearance Sale",
  ];

  try {
    // Find available products with listed categories
    const products = await Product.find({ availability: true }).populate({
      path: "category",
      match: { isListed: true },
    });

    // Filter products to only those with a valid category
    const filteredProducts = products.filter((product) => product.category);

    if (!filteredProducts.length) {
      return res
        .status(404)
        .json({ success: false, message: "Products not found." }); // Handle no products found
    }

    // Render the add product offer page with available products and offer types
    res.status(200).render("admin/addProductOffer.ejs", {
      products: filteredProducts,
      offerTypes: offerTypes,
      layout: "layouts/adminLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("An internal error occurred: ", error);
    res.status(500).json({ message: "An internal error occurred" }); // Handle internal server error
  }
};

// Adds offers to a product
const addProductOffers = async (req, res) => {
  const {
    product,
    offerType,
    fixedDiscount,
    percentageDiscount,
    offerIsActive,
    minimumPurchaseAmount,
    offerExpirationDate,
  } = req.body;

  try {
    // Find the product to update
    const productToUpdate = await Product.findOne({ _id: product });
    if (!productToUpdate) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" }); // Handle product not found
    }

    // Set offer details on the product
    productToUpdate.offer = {
      type: offerType,
      fixedDiscount: fixedDiscount ? parseFloat(fixedDiscount) : 0,
      percentageDiscount: percentageDiscount
        ? parseFloat(percentageDiscount)
        : 0,
      minimumPurchaseAmount: minimumPurchaseAmount
        ? parseFloat(minimumPurchaseAmount)
        : 0,
      isActive: offerIsActive === "true",
      expirationDate: offerExpirationDate
        ? new Date(offerExpirationDate)
        : null,
    };

    await productToUpdate.save(); // Save the updated product

    res.status(200).json({
      success: true,
      message: `${productToUpdate.offer.type} offer added to ${productToUpdate.name}.`, // Success message
    });
  } catch (error) {
    console.error("An internal error occurred: ", error);
    res.status(500).json({ message: "An internal error occurred" }); // Handle internal server error
  }
};

// Fetches categories and products with active offers
const getOffers = async (req, res) => {
  try {
    // Find categories with offers
    const categories = await Category.find({
      offer: { $exists: true, $ne: null }, // Ensure 'offer' field exists and is not null
      $or: [
        { "offer.fixedDiscount": { $gt: 0 } },
        { "offer.percentageDiscount": { $gt: 0 } },
      ],
    });

    // Handle case where no categories found
    if (!categories.length) {
      return res
        .status(404)
        .json({ success: false, message: "Categories with offer not found." });
    }

    // Find products with offers
    const products = await Product.find({
      offer: { $exists: true, $ne: null }, // Ensure 'offer' field exists and is not null
      $or: [
        { "offer.fixedDiscount": { $gt: 0 } },
        { "offer.percentageDiscount": { $gt: 0 } },
      ],
    });

    // Handle case where no products found
    if (!products.length) {
      return res
        .status(404)
        .json({ success: false, message: "Products with offer not found." });
    }

    // Render offers page with found categories and products
    res.status(200).render("admin/offers.ejs", {
      categories,
      products,
      layout: "layouts/adminLayout.ejs",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("An internal error occurred: ", error);
    res.status(500).json({ message: "An internal error occurred" }); // Handle internal server error
  }
};

// Fetches categories with active offers
const getCategoryOffers = async (req, res) => {
  try {
    // Find categories with offers
    const categories = await Category.find({
      offer: { $exists: true, $ne: null }, // Ensure 'offer' field exists and is not null
      $or: [
        { "offer.fixedDiscount": { $gt: 0 } },
        { "offer.percentageDiscount": { $gt: 0 } },
      ],
    });

    // Handle case where no categories found
    if (!categories.length) {
      return res
        .status(404)
        .json({ success: false, message: "Categories with offer not found." });
    }

    // Render category offers page with found categories
    res.status(200).render("admin/categoryOffers.ejs", {
      categories,
      layout: "layouts/adminLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("An internal error occurred: ", error);
    res.status(500).json({ message: "An internal error occurred" }); // Handle internal server error
  }
};

// Fetches products with active offers
const getProductOffers = async (req, res) => {
  try {
    // Find products with offers
    const products = await Product.find({
      offer: { $exists: true, $ne: null }, // Ensure 'offer' field exists and is not null
      $or: [
        { "offer.fixedDiscount": { $gt: 0 } },
        { "offer.percentageDiscount": { $gt: 0 } },
      ],
    });

    // Handle case where no products found
    if (!products.length) {
      return res
        .status(404)
        .json({ success: false, message: "Products with offer not found." });
    }

    // Render product offers page with found products
    res.render("admin/productOffers.ejs", {
      products,
      layout: "layouts/adminLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error("An internal error occurred: ", error);
    res.status(500).json({ message: "An internal error occurred" }); // Handle internal server error
  }
};

// Updates the return status of an order item and processes refunds if applicable
const updateItemReturnStatus = async (req, res) => {
  try {
    const { orderId, orderItemId, returnStatus, returnRejectReason } = req.body; // Get details from request

    // Find the order by ID
    const order = await Order.findById(orderId)
      .populate("orderItems.productId") // Populate the product details for refund description
      .populate("userId")
      .exec();

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Find the specific order item
    const orderItem = order.orderItems.id(orderItemId);
    if (!orderItem) {
      return res
        .status(404)
        .json({ success: false, message: "Order item not found" });
    }

    // Update return status and reject reason if provided
    orderItem.returnStatus = returnStatus;
    if (returnRejectReason) {
      orderItem.returnRejectReason = returnRejectReason;
      orderItem.itemRefundStatus = returnStatus;
      orderItem.itemRefundRejectReason = returnRejectReason;
    }

    // If the return is approved, process the refund
    if (returnStatus === "Approved") {
      orderItem.itemStatus = "Returned"; // Mark the item as returned

      // Find the user to update the wallet balance
      const user = await User.findById(order.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Update the user's wallet balance and add a transaction
      user.wallet.balance += orderItem.itemTotal;
      user.wallet.transactions.push({
        amount: orderItem.itemTotal,
        description: `Refund for ${orderItem.productId.name}`, // Include product name in description
        type: "credit",
      });

      // Mark the refund status as completed
      orderItem.itemRefundStatus = "Completed";

      await user.save(); // Save updated user wallet information
      await order.save(); // Save the updated order with the return status and refund details

      // Send response with refund information
      return res.json({
        success: true,
        message: `Return status updated to ${orderItem.returnStatus} and Rs.${orderItem.itemTotal} refunded to ${user.firstName}'s wallet.`,
      });
    }

    await order.save();

    res.json({
      success: true,
      message: `Return status updated to ${orderItem.returnStatus}.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error updating return status or processing refund",
    });
  }
};

// Updates the exchange status of an order item
const updateItemExchangeStatus = async (req, res) => {
  try {
    const { orderId, orderItemId, exchangeStatus, exchangeRejectReason } =
      req.body; // Get details from request

    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Find the specific order item
    const orderItem = order.orderItems.id(orderItemId);
    if (!orderItem) {
      return res
        .status(404)
        .json({ success: false, message: "Order item not found" });
    }

    // Update exchange status and reject reason if provided
    orderItem.exchangeStatus = exchangeStatus;
    if (exchangeRejectReason) {
      orderItem.exchangeRejectReason = exchangeRejectReason;
    }

    await order.save(); // Save the updated order

    res.json({
      success: true,
      message: "Exchange status updated successfully",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error updating exchange status" });
  }
};

// Updates the refund status of an order item
const updateItemRefundStatus = async (req, res) => {
  try {
    const { orderId, orderItemId, itemRefundStatus, itemRefundRejectReason } =
      req.body; // Get details from request

    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Find the specific order item
    const orderItem = order.orderItems.id(orderItemId);
    if (!orderItem) {
      return res
        .status(404)
        .json({ success: false, message: "Order item not found" });
    }

    // Update refund status and reject reason if provided
    orderItem.itemRefundStatus = itemRefundStatus;
    if (itemRefundRejectReason) {
      orderItem.itemRefundRejectReason = itemRefundRejectReason;
    }

    await order.save(); // Save the updated order

    res.json({ success: true, message: "Refund status updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error updating refund status" });
  }
};

// Handles admin logout
const adminLogout = (req, res) => {
  req.flash("success_msg", "You have successfully logged out"); // Set success message
  req.session.destroy(); // Destroy the session
  res.redirect("/admin/login"); // Redirect to login page
};

module.exports = {
  getAdminLogin,
  adminLogin,
  getDashboard,
  getChart,
  getCategories,
  addCategory,
  toggleCategoryListing,
  getUsers,
  blockUser,
  unblockUser,
  getProducts,
  getAddProduct,
  addProduct,
  getEditProduct,
  editProduct,
  listProduct,
  unlistProduct,
  getAddCoupon,
  addCoupon,
  getCoupons,
  getEditCoupon,
  editCoupon,
  toggleCouponStatus,
  getOrders,
  updateOrderStatus,
  getOrderDetails,
  updateItemStatus,
  updateItemReturnStatus,
  updateItemExchangeStatus,
  updateItemRefundStatus,
  getBanner,
  getAddBanner,
  addBanner,
  updateBanner,
  deleteBanner,
  getAddCategoryOffers,
  addCategoryOffers,
  getAddProductOffers,
  addProductOffers,
  getOffers,
  getCategoryOffers,
  getProductOffers,
  adminLogout,
};