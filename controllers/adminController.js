const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const Admin = require("../models/admin");
const Banner = require("../models/bannerSchema");
const Category = require("../models/category");
const Coupon = require("../models/couponSchema");
const Order = require("../models/orderSchema");
const Product = require("../models/product");
const User = require("../models/user");
const getDateRange = require("../utils/chartUtils");
const HttpStatus = require("../utils/httpStatus");
const errorHandler = require("../utils/errorHandlerUtils");
const successHandler = require("../utils/successHandlerUtils");
const topSelling = require("../utils/topSellingUtils");
const uploadDir = path.join(__dirname, "../public/images/products");

// Render the admin login page
const getAdminLogin = (req, res) => {
  const locals = { title: "Admin Log in | EverGreen" };

  if (req.session && req.session.admin) {
    return res.redirect("/admin/dashboard");
  }

  return res.render("admin/login", {
    locals,
    layout: "layouts/authLayout",
  });
};

// Handle admin login
const adminLogin = async (req, res, next) => {
  const locals = { title: "Admin Log in | EverGreen", message: {} };
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email, isAdmin: true });
    if (!admin) {
      locals.message.error = "Admin not found. Try again using another account.";

      return res.status(HttpStatus.NOT_FOUND).render("admin/login", {
        locals,
        layout: "layouts/authLayout",
      });
    }

    const validatePassword = await bcrypt.compare(password, admin.password);
    if (!validatePassword) {
      locals.message.error = "Incorrect password. Try again.";

      return res.status(HttpStatus.UNAUTHORIZED).render("admin/login", {
        locals,
        layout: "layouts/authLayout",
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

    return res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Error occurred while login: ", err);
    return next(err);
  }
};

// Handle fetching and rendering the Admin dashboard
const getDashboard = async (req, res, next) => {
  const locals = { title: "Admin Dashboard | EverGreen", message: {} };

  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments({ orderStatus: "Delivered" });
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: "Delivered" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    return res.render("admin/dashboard", {
      locals,
      layout: "layouts/adminLayout",
      admin: req.session.admin,
      topCategories: await topSelling.getTopCategories(),
      bestsellingProducts: await topSelling.getBestSellingProducts(),
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
    });
  } catch (err) {
    console.error("Error fetching dashboard data: ", err);
    return next(err);
  }
};

// Function for product order analysis
const getProductOrderAnalysis = async (dateRange, filterDate) => {
  const { startDate, endDate } = getDateRange(dateRange, filterDate);

  const orders = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
    { $unwind: "$orderItems" },
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
        _id: "$productDetails.name",
        totalQuantity: { $sum: "$orderItems.quantity" },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
  ]);

  const labels = orders.map((order) => order._id);
  const data = orders.map((order) => order.totalQuantity);

  return { labels, orders: data };
};

// Function for category order analysis
const getCategoryOrderAnalysis = async (dateRange, filterDate) => {
  const { startDate, endDate } = getDateRange(dateRange, filterDate);

  const orders = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
    { $unwind: "$orderItems" },
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
      $lookup: {
        from: "categories",
        localField: "productDetails.category",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    { $unwind: "$categoryDetails" },
    {
      $group: {
        _id: "$categoryDetails.name",
        totalQuantity: { $sum: "$orderItems.quantity" },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
  ]);

  const labels = orders.map((order) => order._id);
  const data = orders.map((order) => order.totalQuantity);

  return { labels, orders: data };
};

// Retrieves chart data for products or categories based on filter type
const getChart = async (req, res, next) => {
  const { filterType, dateRange, filterDate } = req.query;
  console.log(`Received request for filterType=${filterType}, dateRange=${dateRange}, filterDate=${filterDate}`);

  try {
    let data;
    if (filterType === "products") {
      data = await getProductOrderAnalysis(dateRange, filterDate);
    } else {
      data = await getCategoryOrderAnalysis(dateRange, filterDate);
    }
    console.log("Sending data: ", data);
    return res.json(data);
  } catch (err) {
    console.error("Error processing request: ", err);
    return next(err);
  }
};

// Fetch and render categories page
const getCategories = async (req, res, next) => {
  const locals = { title: "Admin Categories | EverGreen", message: {} };

  try {
    const categories = await Category.find().lean().sort({ createdAt: -1 });
    if (categories.length === 0) {
      locals.message.error = "No categories available. Please add categories to list them.";
    }

    return res.render("admin/categories", {
      locals,
      categories,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching categories: ", err);
    return next(err);
  }
};

// Add or update a category
const addCategory = async (req, res, next) => {
  const { categoryId, categoryName, status, description } = req.body;

  try {
    if (categoryId) {
      await Category.findByIdAndUpdate(categoryId, {
        name: categoryName,
        status,
        description,
      });

      return successHandler(res, HttpStatus.OK, `${categoryName} category updated successfully.`);
    } else {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, "i") },
      });
      if (existingCategory) {
        return errorHandler(res, HttpStatus.CONFLICT, `${categoryName} category already exists.`);
      }

      // Create and save new category
      const newCategory = new Category({
        name: categoryName,
        status,
        description,
      });
      await newCategory.save();

      return successHandler(res, HttpStatus.CREATED, `${newCategory.name} category added successfully.`);
    }
  } catch (err) {
    console.error("Error creating category: ", err);
    return next(err);
  }
};

// Toggle category listing status
const toggleCategoryListing = async (req, res, next) => {
  const categoryId = req.params.id;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return errorHandler(res, HttpStatus.NOT_FOUND, `Category not found. Please try again.`);
    }

    category.isListed = !category.isListed;
    category.status = category.isListed ? "active" : "inactive";
    await category.save();

    return successHandler(res, HttpStatus.OK, `${category.name} ${category.isListed ? "listed" : "unlisted"} successfully`);
  } catch (err) {
    console.error("Error toggling category listing: ", err);
    return next(err);
  }
};

// Get list of users
const getUsers = async (req, res, next) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };

  try {
    const users = await User.find().lean().sort({ createdAt: -1 });
    if (users.length === 0) {
      locals.message.error = "The user list is empty. Please check back later.";
    }

    return res.render("admin/users", {
      locals,
      users,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching users: ", err);
    return next(err);
  }
};

// Block a user
const blockUser = async (req, res, next) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      locals.message.error = "User not found!";

      return res.status(HttpStatus.NOT_FOUND).render("admin/users", {
        locals,
        users: await User.find().lean(),
        layout: "layouts/adminLayout",
      });
    }

    // Block user
    user.status = false;
    await user.save();

    locals.message.success = `${user.firstName} ${user.lastName} has been blocked successfully`;

    return res.render("admin/users", {
      locals,
      users: await User.find().lean(),
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error blocking the user: ", err);
    return next(err);
  }
};

// Unblock a user
const unblockUser = async (req, res, next) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      locals.message.error = "User not found!";

      return res.status(HttpStatus.NOT_FOUND).render("admin/users", {
        locals,
        users: await User.find(),
        layout: "layouts/adminLayout",
      });
    }

    // Unblock user
    user.status = true;
    await user.save();

    locals.message.success = `${user.firstName} ${user.lastName} has been unblocked successfully`;

    return res.render("admin/users", {
      locals,
      users: await User.find(),
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error unblocking the user: ", err);
    return next(err);
  }
};

// Fetch and render the products
const getProducts = async (req, res, next) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };

  try {
    const categories = await Category.find().lean();
    const products = await Product.find().lean().sort({ createdAt: -1 });

    if (categories.length === 0) {
      locals.message.error = "No categories available. Please add categories to list products.";
    }
    if (products.length === 0) {
      locals.message.error = "No products available. Please try adding some.";
    }

    return res.render("admin/products", {
      locals,
      products,
      categories,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error(`Error fetching categories or products: `, err);
    return next(err);
  }
};

// Fetch and render the add product page
const getAddProduct = async (req, res, next) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };

  try {
    const categories = await Category.find({ isListed: true });
    if (categories.length === 0) {
      locals.message.error = "Error fetching categories. Please try again later.";
    }

    return res.render("admin/addProduct", {
      locals,
      categories,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching categories: ", err);
    return next(err);
  }
};

// Add a new product to the database
const addProduct = async (req, res, next) => {
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

    const imagePaths = images.map((file) => file.filename);

    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingProduct) {
      return res.status(HttpStatus.CONFLICT).json({
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

    return res.status(HttpStatus.CREATED).json({
      success: true,
      product: newProduct,
      message: `${newProduct.name} added successfully`,
      redirectUrl
    });
  } catch (err) {
    console.error("Error adding the product: ", err);
    return next(err);
  }
};

// Fetch product details for editing
const getEditProduct = async (req, res, next) => {
  const locals = { title: "Admin - Edit Products | EverGreen", message: {} };

  try {
    const categories = await Category.find({ isListed: true });
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Product not found!",
        originalUrl: req.originalUrl,
      });
    }

    return res.render("admin/editProduct", {
      locals,
      categories,
      product,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching the product: ", err);
    return next(err);
  }
};

// Update product details
const editProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const { removeImage, redirectUrl } = req.body;
    let newImages = req.files;

    const product = await Product.findById(productId);
    if (!product) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found.");
    }

    // Handle image removal
    if (removeImage) {
      removeImage.forEach((image) => {
        const imagePath = path.join(uploadDir, image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
      product.images = product.images.filter((image) => !removeImage.includes(image));
    }

    // Handle new image uploads
    if (newImages && newImages.length > 0) {
      newImages.forEach((file) => {
        product.images.push(file.filename);
      });
    }

    product.name = req.body.name;
    product.description = req.body.description;
    product.price = req.body.price;
    product.discountPrice = req.body.discountPrice;
    product.category = req.body.category;
    product.stock = req.body.stock;
    product.availability = req.body.availability === "true";
    product.featured = req.body.featured === "on";

    const updatedProduct = await product.save();

    return res.status(HttpStatus.OK).json({
        success: true,
        updatedProduct,
        message: "Product updated successfully.",
        redirectUrl,
      });
  } catch (err) {
    console.error("Error updating the product: ", err);
    return next(err);
  }
};

// List a product as available
const listProduct = async (req, res, next) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };
  const productId = req.params.productId;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      locals.message.error = "Product not found! Please try again.";

      return res.status(HttpStatus.NOT_FOUND).render("admin/products", {
        locals,
        products: await Product.find(),
        layout: "layouts/adminLayout",
      });
    }

    product.availability = true;
    await product.save();

    locals.message.success = `${product.name} listed successfully`;

    return res.render("admin/products", {
      locals,
      products: await Product.find(),
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error listing the product: ", err);
    return next(err);
  }
};

// Unlist a product by setting its availability to false
const unlistProduct = async (req, res, next) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };
  const productId = req.params.productId;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      locals.message.error = "Product not found! Please try again.";

      return res.status(HttpStatus.NOT_FOUND).render("admin/products", {
        locals,
        products: await Product.find(),
        layout: "layouts/adminLayout",
      });
    }

    product.availability = false;
    await product.save();

    locals.message.success = `${product.name} unlisted successfully`;

    return res.render("admin/products", {
      locals,
      products: await Product.find(),
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error unlisting the product: ", err);
    return next(err);
  }
};

// Render the add coupon page
const getAddCoupon = (req, res) => {
  const locals = { title: "Admin - Add Coupon | EverGreen" };

  return res.render("admin/addCoupon", {
    locals,
    layout: "layouts/adminLayout",
  });
};

// Adds a new coupon to the database
const addCoupon = async (req, res, next) => {
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

    return successHandler(res, HttpStatus.CREATED, `${newCoupon.code} added successfully`);
  } catch (err) {
    console.error("Error adding the coupon: ", err);
    return next(err);
  }
};

// Retrieves and displays all coupons
const getCoupons = async (req, res, next) => {
  const locals = { title: "Admin - Coupons | EverGreen" };

  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });

    return res.render("admin/coupons", {
      locals,
      coupons,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching coupons: ", err);
    return next(err);
  }
};

// Retrieves and displays a coupon for editing
const getEditCoupon = async (req, res, next) => {
  const locals = { title: "Admin - Edit Coupon | EverGreen" };

  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Coupon not found.");
    }

    return res.render("admin/editCoupon", {
      locals,
      coupon,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching the edit coupon page: ", err);
    return next(err);
  }
};

// Updates a coupon based on provided data
const editCoupon = async (req, res, next) => {
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
      { new: true }
    );

    return res.status(HttpStatus.OK).json({
      success: true,
      message: `${updatedCoupon.code} updated successfully`,
      coupon: updatedCoupon,
    });
  } catch (err) {
    console.error("Error updating the coupon: ", err);
    return next(err);
  }
};

// Toggles the active status of a coupon
const toggleCouponStatus = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Coupon not found.");
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    return res.status(HttpStatus.OK).json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
      coupon,
    });
  } catch (err) {
    console.error("Error toggling the status of the coupon: ", err);
    return next(err);
  }
};

// Fetches and renders the list of orders
const getOrders = async (req, res, next) => {
  const locals = { title: "Admin - Orders List | EverGreen", message: {} };

  try {
    const orders = await Order.find()
      .populate("userId")
      .populate("couponId")
      .sort({ createdAt: -1 });

    return res.render("admin/orders", {
      locals,
      orders,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching orders: ", err);
    return next(err);
  }
};

// Update the status of an order
const updateOrderStatus = async (req, res, next) => {
  const { orderStatus } = req.body;
  const { id } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    order.orderStatus = orderStatus;

    if (order.paymentMethod === "COD" && order.orderStatus === "Delivered") {
      order.orderPaymentStatus = "Success";
    }

    await order.save();

    return successHandler(res, HttpStatus.OK, `Order status changed to ${orderStatus}.`);
  } catch (err) {
    console.error("Error changing order status: ", err);
    return next(err);
  }
};

// Fetches and displays order details
const getOrderDetails = async (req, res, next) => {
  const locals = { title: "Admin Order Details | EverGreen" };

  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("couponId")
      .populate("shippingAddress");

    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    return res.render("admin/orderDetails", {
      locals,
      order,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching order details: ", err);
    return next(err);
  }
};

// Update the status of an item in an order
const updateItemStatus = async (req, res, next) => {
  const { orderId, itemId } = req.params;
  const { itemStatus } = req.body;

  try {
    const order = await Order.findById(orderId).populate("orderItems.productId");
    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    const item = order.orderItems.id(itemId);
    if (!item) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Item not found.");
    }

    item.itemStatus = itemStatus;
    await order.save();

    return res.status(HttpStatus.OK).json({
      success: true,
      message: `${item.productId.name} status has been updated to ${itemStatus}`,
      updatedItem: item,
    });
  } catch (err) {
    console.error("Error updating item status: ", err);
    return next(err);
  }
};

// Fetches and renders the banner page for admin
const getBanner = async (req, res, next) => {
  const locals = { title: "Admin Banners | EverGreen" };

  try {
    const banners = await Banner.find().sort({ createdAt: -1 });

    return res.render("admin/banners", {
      locals,
      banners,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching banners: ", err);
    return next(err);
  }
};

// Renders the add banner page for admin
const getAddBanner = (req, res) => {
  const locals = { title: "Admin - Add Banner | EverGreen" };

  return res.render("admin/addBanner", {
    locals,
    layout: "layouts/adminLayout",
  });
};

// Adds a new banner to the database
const addBanner = async (req, res, next) => {
  try {
    const { title, description, isActive } = req.body;
    const image = req.file;
    if (!image) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Image is required for upload.");
    }

    const imageUrl = image.filename;

    const newBanner = new Banner({
      title,
      imageUrl,
      description,
      isActive: isActive === "on",
    });

    await newBanner.save();

    return res.status(HttpStatus.CREATED).json({
        success: true,
        message: "Banner added successfully.",
        banner: newBanner,
      });
  } catch (err) {
    console.error("Error adding banner: ", err);
    return next(err);
  }
};

// Updates an existing banner in the database
const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, isActive } = req.body;
    const image = req.file;

    const updateData = { title, description, isActive };
    if (image) {
      updateData.imageUrl = image.filename;
    }

    const updatedBanner = await Banner.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!updatedBanner) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Banner not found.");
    }

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Banner updated successfully.",
      banner: updatedBanner,
    });
  } catch (err) {
    console.error("Error updating banner: ", err);
    return next(err);
  }
};

// Delete a banner
const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedBanner = await Banner.findByIdAndDelete(id);

    if (!deletedBanner) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Banner not found.");
    }

    if (deletedBanner.imageUrl) {
      fs.unlink(path.join("public", deletedBanner.imageUrl), (err) => {
        if (err) console.error("Error deleting banner image: ", err);
      });
    }

    return successHandler(res, HttpStatus.OK, "Banner deleted successfully.");
  } catch (err) {
    console.error("Error deleting banner: ", err);
    return next(err);
  }
};

// Renders the add category offers page
const getAddCategoryOffers = async (req, res, next) => {
  const locals = { title: "Admin Add Category offers | EverGreen" };
  const offerTypes = [
    "Seasonal",
    "Flash Sale",
    "Weekend Special",
    "Festive Discount",
    "Clearance Sale",
  ];

  try {
    const categories = await Category.find({ isListed: true });
    if (!categories) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Categories not found.");
    }

    return res.render("admin/addCategoryOffer", {
      locals,
      categories,
      offerTypes,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching add category offers page: ", err);
    return next(err);
  }
};

// Adds an offer to a specified category
const addCategoryOffers = async (req, res, next) => {
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
    const categoryToUpdate = await Category.findOne({ name: category });
    if (!categoryToUpdate) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Category not found.");
    }

    categoryToUpdate.offer = {
      type: offerType,
      fixedDiscount: fixedDiscount ? parseFloat(fixedDiscount) : 0,
      percentageDiscount: percentageDiscount ? parseFloat(percentageDiscount) : 0,
      minimumPurchaseAmount: minimumPurchaseAmount ? parseFloat(minimumPurchaseAmount) : 0,
      isActive: offerIsActive === "true",
      expirationDate: offerExpirationDate ? new Date(offerExpirationDate) : null,
    };

    await categoryToUpdate.save();

    return successHandler(res, HttpStatus.CREATED, `${categoryToUpdate.offer.type} offer added to ${categoryToUpdate.name}.`);
  } catch (err) {
    console.error("Error adding category offer: ", err);
    return next(err);
  }
};

// Retrieves products for adding offers
const getAddProductOffers = async (req, res, next) => {
  const locals = { title: "Admin Add Product offers | EverGreen" };
  const offerTypes = [
    "Seasonal",
    "Flash Sale",
    "Weekend Special",
    "Festive Discount",
    "Clearance Sale",
  ];

  try {
    const products = await Product.find({ availability: true }).populate({
      path: "category",
      match: { isListed: true },
    });

    const filteredProducts = products.filter((product) => product.category);

    if (filteredProducts.length === 0) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Products not found.");
    }

    return res.render("admin/addProductOffer", {
      locals,
      products: filteredProducts,
      offerTypes: offerTypes,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching add products offers page: ", err);
    return next(err);
  }
};

// Adds offers to a product
const addProductOffers = async (req, res, next) => {
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
    const productToUpdate = await Product.findOne({ _id: product });
    if (!productToUpdate) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found.");
    }

    productToUpdate.offer = {
      type: offerType,
      fixedDiscount: fixedDiscount ? parseFloat(fixedDiscount) : 0,
      percentageDiscount: percentageDiscount ? parseFloat(percentageDiscount) : 0,
      minimumPurchaseAmount: minimumPurchaseAmount ? parseFloat(minimumPurchaseAmount) : 0,
      isActive: offerIsActive === "true",
      expirationDate: offerExpirationDate ? new Date(offerExpirationDate) : null,
    };

    await productToUpdate.save();

    return successHandler(res, HttpStatus.CREATED, `${productToUpdate.offer.type} offer added to ${productToUpdate.name}.`);
  } catch (err) {
    console.error("Error adding products offer: ", err);
    return next(err);
  }
};

// Fetches categories and products with active offers
const getOffers = async (req, res, next) => {
  const locals = { title: "Admin Offers | EverGreen" };

  try {
    const categories = await Category.find({
      offer: { $exists: true, $ne: null },
      $or: [
        { "offer.fixedDiscount": { $gt: 0 } },
        { "offer.percentageDiscount": { $gt: 0 } },
      ],
    });

    if (categories.length === 0) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Categories with offer not found.");
    }

    const products = await Product.find({
      offer: { $exists: true, $ne: null },
      $or: [
        { "offer.fixedDiscount": { $gt: 0 } },
        { "offer.percentageDiscount": { $gt: 0 } },
      ],
    });

    if (products.length === 0) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Products with offer not found.");
    }

    return res.render("admin/offers", {
      locals,
      categories,
      products,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching offers page: ", err);
    return next(err);
  }
};

// Fetches categories with active offers
const getCategoryOffers = async (req, res, next) => {
  const locals = { title: "Admin Category Offers | EverGreen" };

  try {
    const categories = await Category.find({
      offer: { $exists: true, $ne: null },
      $or: [
        { "offer.fixedDiscount": { $gt: 0 } },
        { "offer.percentageDiscount": { $gt: 0 } },
      ],
    });

    if (categories.length === 0) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Categories with offer not found.");
    }

    return res.render("admin/categoryOffers", {
      locals,
      categories,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching category offers: ", err);
    return next(err);
  }
};

// Fetches products with active offers
const getProductOffers = async (req, res, next) => {
  const locals = { title: "Admin Category Offers | EverGreen" };

  try {
    const products = await Product.find({
      offer: { $exists: true, $ne: null },
      $or: [
        { "offer.fixedDiscount": { $gt: 0 } },
        { "offer.percentageDiscount": { $gt: 0 } },
      ],
    });

    if (products.length === 0) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Products with offer not found.");
    }

    return res.render("admin/productOffers", {
      locals,
      products,
      layout: "layouts/adminLayout",
    });
  } catch (err) {
    console.error("Error fetching product offers: ", err);
    return next(err);
  }
};

// Updates the return status of an order item and processes refunds if applicable
const updateItemReturnStatus = async (req, res, next) => {
  try {
    const { orderId, orderItemId, returnStatus, returnRejectReason } = req.body;
    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("userId")
      .exec();

    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    const orderItem = order.orderItems.id(orderItemId);
    if (!orderItem) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order item not found.");
    }

    orderItem.returnStatus = returnStatus;
    if (returnRejectReason) {
      orderItem.returnRejectReason = returnRejectReason;
      orderItem.itemRefundStatus = returnStatus;
      orderItem.itemRefundRejectReason = returnRejectReason;
    }

    if (returnStatus === "Approved") {
      orderItem.itemStatus = "Returned";

      const user = await User.findById(order.userId);
      if (!user) {
        return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
      }

      user.wallet.balance += orderItem.itemTotal;
      user.wallet.transactions.push({
        amount: orderItem.itemTotal,
        description: `Refund for ${orderItem.productId.name}`,
        type: "credit",
      });
      orderItem.itemRefundStatus = "Completed";

      await user.save();
      await order.save();

      return successHandler(
        res,
        HttpStatus.CREATED,
        `Return status updated to ${orderItem.returnStatus} and Rs.${orderItem.itemTotal} refunded to ${user.firstName}'s wallet.`
      );
    }
  } catch (err) {
    console.error("Error updating the return status of the item and processing refund: ", err);
    return next(err);
  }
};

// Updates the exchange status of an order item
const updateItemExchangeStatus = async (req, res, next) => {
  try {
    const { orderId, orderItemId, exchangeStatus, exchangeRejectReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    const orderItem = order.orderItems.id(orderItemId);
    if (!orderItem) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order item not found.");
    }

    orderItem.exchangeStatus = exchangeStatus;

    if (exchangeRejectReason) {
      orderItem.exchangeRejectReason = exchangeRejectReason;
    }

    await order.save();

    return successHandler(res, HttpStatus.CREATED, "Exchange status updated successfully");
  } catch (err) {
    console.error("Error updating the exchange status of the item: ", err);
    return next(err);
  }
};

// Updates the refund status of an order item
const updateItemRefundStatus = async (req, res, next) => {
  try {
    const { orderId, orderItemId, itemRefundStatus, itemRefundRejectReason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    const orderItem = order.orderItems.id(orderItemId);
    if (!orderItem) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order item not found.");
    }

    orderItem.itemRefundStatus = itemRefundStatus;

    if (itemRefundRejectReason) {
      orderItem.itemRefundRejectReason = itemRefundRejectReason;
    }

    await order.save();

    return successHandler(res, HttpStatus.CREATED, "Refund status updated successfully");
  } catch (err) {
    console.error("Error updating the refund status of the item: ", err);
    return next(err);
  }
};

// Handles admin logout
const adminLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying the session: ", err);
      return next(err);
    }
    return res.redirect("/admin/login");
  });
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