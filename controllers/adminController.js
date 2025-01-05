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

  res.render("admin/login", {
    locals,
    layout: "layouts/authLayout",
  });
};

// Handle admin login
const adminLogin = async (req, res) => {
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
  } catch (error) {
    console.error("Error occurred while login: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Handle fetching and rendering the Admin dashboard
const getDashboard = async (req, res) => {
  const locals = { title: "Admin Dashboard | EverGreen", message: {} };

  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments({ orderStatus: "Delivered" });

    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: "Delivered" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    res.render("admin/dashboard", {
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
  } catch (error) {
    console.error("Error fetching dashboard data: ", error);
    throw new Error("An error occurred. Please try again later.");
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
const getChart = async (req, res) => {
  const { filterType, dateRange, filterDate } = req.query;

  try {
    let data;

    if (filterType === "products") {
      data = await getProductOrderAnalysis(dateRange, filterDate);
    } else {
      data = await getCategoryOrderAnalysis(dateRange, filterDate);
    }

    return res.json(data);
  } catch (error) {
    console.error("Error processing request: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetch and render categories page
const getCategories = async (req, res) => {
  const locals = { title: "Admin Categories | EverGreen", message: {} };

  try {
    const categories = await Category.find()
      .sort({ createdAt: -1 })
      .lean();

    if (categories.length === 0) {
      locals.message.error = "No categories available. Please add categories to list them.";
    }

    res.render("admin/categories", {
      locals,
      categories,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching categories: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Add or update a category
const addCategory = async (req, res) => {
  const { categoryId, categoryName, status, description } = req.body;

  try {
    if (categoryId) {
      await Category.findByIdAndUpdate(
        categoryId, 
        {
          name: categoryName,
          status,
          description,
        },
      );

      return successHandler(res, HttpStatus.OK, `${categoryName} category updated successfully.`);
    } else {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, "i") },
      });
      if (existingCategory) {
        return errorHandler(res, HttpStatus.CONFLICT, `${categoryName} category already exists.`);
      }

      // Create and save new category
      const newCategory = await Category.create({
        name: categoryName,
        status,
        description,
      });

      return successHandler(res, HttpStatus.CREATED, `${newCategory.name} category added successfully.`);
    }
  } catch (error) {
    console.error("Error creating category: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Toggle category listing status
const toggleCategoryListing = async (req, res) => {
  const categoryId = req.params.id;

  try {
    const category = await Category.findById(categoryId).select("isListed status");
    if (!category) {
      return errorHandler(res, HttpStatus.NOT_FOUND, `Category not found. Please try again.`);
    }

    category.isListed = !category.isListed;
    category.status = category.isListed ? "active" : "inactive";
    await category.save();

    return successHandler(res, HttpStatus.OK, `${category.name} ${category.isListed ? "listed" : "unlisted"} successfully`);
  } catch (error) {
    console.error("Error toggling category listing: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Get list of users
const getUsers = async (req, res) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };

  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .lean();

    if (users.length === 0) {
      locals.message.error = "The user list is empty. Please check back later.";
    }

    return res.render("admin/users", {
      locals,
      users,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching users: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Block a user
const blockUser = async (req, res) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };
  const userId = req.params.userId;

  try {
    let users = await User.find().lean();
    const user = await User.findById(userId).select("status");
    if (!user) {
      locals.message.error = "User not found!";

      return res.status(HttpStatus.NOT_FOUND).render("admin/users", {
        locals,
        users,
        layout: "layouts/adminLayout",
      });
    }

    // Block user
    user.status = false;
    await user.save();

    locals.message.success = `${user.firstName} ${user.lastName} has been blocked successfully`;
    users = await User.find().lean();

    res.render("admin/users", {
      locals,
      users,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error blocking the user: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Unblock a user
const unblockUser = async (req, res) => {
  const locals = { title: "Admin - Users List | EverGreen", message: {} };
  const userId = req.params.userId;

  try {
    let users = await User.find().lean();
    const user = await User.findById(userId).select("status");
    if (!user) {
      locals.message.error = "User not found!";

      return res.status(HttpStatus.NOT_FOUND).render("admin/users", {
        locals,
        users,
        layout: "layouts/adminLayout",
      });
    }

    // Unblock user
    user.status = true;
    await user.save();

    locals.message.success = `${user.firstName} ${user.lastName} has been unblocked successfully`;
    users = await User.find().lean();

    res.render("admin/users", {
      locals,
      users,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error unblocking the user: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetch and render the products
const getProducts = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };

  try {
    const categories = await Category.find().lean();
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .lean();

    if (categories.length === 0) {
      locals.message.error = "No categories available. Please add categories to list products.";
    }
    if (products.length === 0) {
      locals.message.error = "No products available. Please try adding some.";
    }

    res.render("admin/products", {
      locals,
      products,
      categories,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error(`Error fetching categories or products: `, error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetch and render the add product page
const getAddProduct = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };

  try {
    const categories = await Category.find({ isListed: true }).lean();
    if (categories.length === 0) {
      locals.message.error = "Error fetching categories. Please try again later.";
    }

    res.render("admin/addProduct", {
      locals,
      categories,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching categories: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Add a new product to the database
const addProduct = async (req, res) => {
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
    const newProduct = await Product.create({
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

    return res.status(HttpStatus.CREATED).json({
      success: true,
      product: newProduct,
      message: `${newProduct.name} added successfully`,
      redirectUrl,
    });
  } catch (error) {
    console.error("Error adding the product: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetch product details for editing
const getEditProduct = async (req, res) => {
  const locals = { title: "Admin - Edit Products | EverGreen", message: {} };
  const productId = req.params.id;

  try {
    const categories = await Category.find({ isListed: true }).lean();
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Product not found!",
        originalUrl: req.originalUrl,
      });
    }

    res.render("admin/editProduct", {
      locals,
      categories,
      product,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching the product: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Update product details
const editProduct = async (req, res) => {
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
  } catch (error) {
    console.error("Error updating the product: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// List a product as available
const listProduct = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };
  const productId = req.params.productId;

  try {
    let products = await Product.find().lean();
    const product = await Product.findById(productId).select("availability");
    if (!product) {
      locals.message.error = "Product not found! Please try again.";

      return res.status(HttpStatus.NOT_FOUND).render("admin/products", {
        locals,
        products,
        layout: "layouts/adminLayout",
      });
    }

    product.availability = true;
    await product.save();

    locals.message.success = `${product.name} listed successfully`;
    products = await Product.find().lean();

    res.render("admin/products", {
      locals,
      products,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error listing the product: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Unlist a product by setting its availability to false
const unlistProduct = async (req, res) => {
  const locals = { title: "Admin - Products List | EverGreen", message: {} };
  const productId = req.params.productId;

  try {
    let products = await Product.find().lean();
    const product = await Product.findById(productId).select("availability");
    if (!product) {
      locals.message.error = "Product not found! Please try again.";

      return res.status(HttpStatus.NOT_FOUND).render("admin/products", {
        locals,
        products,
        layout: "layouts/adminLayout",
      });
    }

    product.availability = false;
    await product.save();

    locals.message.success = `${product.name} unlisted successfully`;
    products = await Product.find().lean();

    res.render("admin/products", {
      locals,
      products,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error unlisting the product: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Render the add coupon page
const getAddCoupon = (req, res) => {
  const locals = { title: "Admin - Add Coupon | EverGreen" };

  res.render("admin/addCoupon", {
    locals,
    layout: "layouts/adminLayout",
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
    const newCoupon = await Coupon.create({
      code,
      discountType,
      discountValue,
      minimumPurchaseAmount,
      expirationDate,
      isActive: isActive ? true : false,
    });

    return successHandler(res, HttpStatus.CREATED, `${newCoupon.code} added successfully`);
  } catch (error) {
    console.error("Error adding the coupon: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Retrieves and displays all coupons
const getCoupons = async (req, res) => {
  const locals = { title: "Admin - Coupons | EverGreen" };

  try {
    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .lean();

    res.render("admin/coupons", {
      locals,
      coupons,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching coupons: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Retrieves and displays a coupon for editing
const getEditCoupon = async (req, res) => {
  const locals = { title: "Admin - Edit Coupon | EverGreen" };

  try {
    const coupon = await Coupon.findById(req.params.id).lean();
    if (!coupon) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Coupon not found.");
    }

    res.render("admin/editCoupon", {
      locals,
      coupon,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching the edit coupon page: ", error);
    throw new Error("An error occurred. Please try again later.");
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
      { new: true },
    );

    return res.status(HttpStatus.OK).json({
      success: true,
      message: `${updatedCoupon.code} updated successfully`,
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error("Error updating the coupon: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Toggles the active status of a coupon
const toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id).select("isActive");
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
  } catch (error) {
    console.error("Error toggling the status of the coupon: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetches and renders the list of orders
const getOrders = async (req, res) => {
  const locals = { title: "Admin - Orders List | EverGreen", message: {} };

  try {
    const orders = await Order.find()
      .populate("userId")
      .populate("couponId")
      .sort({ createdAt: -1 })
      .lean();

    res.render("admin/orders", {
      locals,
      orders,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching orders: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Update the status of an order
const updateOrderStatus = async (req, res) => {
  const { orderStatus } = req.body;
  const { id } = req.params;

  try {
    const order = await Order.findById(id).select("orderStatus paymentMethod orderPaymentStatus");
    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    order.orderStatus = orderStatus;

    if (order.paymentMethod === "COD" && order.orderStatus === "Delivered") {
      order.orderPaymentStatus = "Success";
    }

    await order.save();

    return successHandler(res, HttpStatus.OK, `Order status changed to ${orderStatus}.`);
  } catch (error) {
    console.error("Error changing order status: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetches and displays order details
const getOrderDetails = async (req, res) => {
  const locals = { title: "Admin Order Details | EverGreen" };

  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("orderItems.productId")
      .populate("couponId")
      .populate("shippingAddress")
      .lean();

    if (!order) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Order not found.");
    }

    res.render("admin/orderDetails", {
      locals,
      order,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching order details: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Update the status of an item in an order
const updateItemStatus = async (req, res) => {
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
  } catch (error) {
    console.error("Error updating item status: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetches and renders the banner page for admin
const getBanner = async (req, res) => {
  const locals = { title: "Admin Banners | EverGreen" };

  try {
    const banners = await Banner.find()
      .sort({ createdAt: -1 })
      .lean();

    res.render("admin/banners", {
      locals,
      banners,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching banners: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Renders the add banner page for admin
const getAddBanner = (req, res) => {
  const locals = { title: "Admin - Add Banner | EverGreen" };

  res.render("admin/addBanner", {
    locals,
    layout: "layouts/adminLayout",
  });
};

// Adds a new banner to the database
const addBanner = async (req, res) => {
  const { title, description, isActive } = req.body;

  try {
    const image = req.file;
    if (!image) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Image is required for upload.");
    }

    const imageUrl = image.filename;

    const newBanner = await Banner.create({
      title,
      imageUrl,
      description,
      isActive: isActive === "on",
    });

    return res.status(HttpStatus.CREATED).json({
        success: true,
        message: "Banner added successfully.",
        banner: newBanner,
      });
  } catch (error) {
    console.error("Error adding banner: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Updates an existing banner in the database
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, isActive } = req.body;
    const image = req.file;

    const updateData = { title, description, isActive };
    if (image) {
      updateData.imageUrl = image.filename;
    }

    const updatedBanner = await Banner.findByIdAndUpdate(
      id, 
      updateData,
      { new: true },
    );

    if (!updatedBanner) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Banner not found.");
    }

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Banner updated successfully.",
      banner: updatedBanner,
    });
  } catch (error) {
    console.error("Error updating banner: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Delete a banner
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBanner = await Banner.findByIdAndDelete(id);

    if (!deletedBanner) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Banner not found.");
    }

    if (deletedBanner.imageUrl) {
      fs.unlink(path.join("public", deletedBanner.imageUrl), (error) => {
        if (error) {
          console.error("Error deleting banner image: ", error);
        }
      });
    }

    return successHandler(res, HttpStatus.OK, "Banner deleted successfully.");
  } catch (error) {
    console.error("Error deleting banner: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Renders the add category offers page
const getAddCategoryOffers = async (req, res) => {
  const locals = { title: "Admin Add Category offers | EverGreen" };
  const offerTypes = [
    "Seasonal",
    "Flash Sale",
    "Weekend Special",
    "Festive Discount",
    "Clearance Sale",
  ];

  try {
    const categories = await Category.find({ isListed: true }).lean();
    if (!categories) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Categories not found.");
    }

    res.render("admin/addCategoryOffer", {
      locals,
      categories,
      offerTypes,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching add category offers page: ", error);
    throw new Error("An error occurred. Please try again later.");
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
  } catch (error) {
    console.error("Error adding category offer: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Retrieves products for adding offers
const getAddProductOffers = async (req, res) => {
  const locals = { title: "Admin Add Product offers | EverGreen" };
  const offerTypes = [
    "Seasonal",
    "Flash Sale",
    "Weekend Special",
    "Festive Discount",
    "Clearance Sale",
  ];

  try {
    const products = await Product.find({ availability: true })
      .populate({
        path: "category",
        match: { isListed: true },
      });

    const filteredProducts = products.filter((product) => product.category);

    if (filteredProducts.length === 0) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Products not found.");
    }

    res.render("admin/addProductOffer", {
      locals,
      products: filteredProducts,
      offerTypes: offerTypes,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching add products offers page: ", error);
    throw new Error("An error occurred. Please try again later.");
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
  } catch (error) {
    console.error("Error adding products offer: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetches categories and products with active offers
const getOffers = async (req, res) => {
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

    res.render("admin/offers", {
      locals,
      categories,
      products,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching offers page: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetches categories with active offers
const getCategoryOffers = async (req, res) => {
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

    res.render("admin/categoryOffers", {
      locals,
      categories,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching category offers: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Fetches products with active offers
const getProductOffers = async (req, res) => {
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

    res.render("admin/productOffers", {
      locals,
      products,
      layout: "layouts/adminLayout",
    });
  } catch (error) {
    console.error("Error fetching product offers: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Updates the return status of an order item and processes refunds if applicable
const updateItemReturnStatus = async (req, res) => {
  const { orderId, orderItemId, returnStatus, returnRejectReason } = req.body;

  try {
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
        `Return status updated to ${orderItem.returnStatus} and Rs.${orderItem.itemTotal} refunded to ${user.firstName}'s wallet.`,
      );
    }
  } catch (error) {
    console.error("Error updating the return status of the item and processing refund: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Updates the exchange status of an order item
const updateItemExchangeStatus = async (req, res) => {
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
  } catch (error) {
    console.error("Error updating the exchange status of the item: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Updates the refund status of an order item
const updateItemRefundStatus = async (req, res) => {
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
  } catch (error) {
    console.error("Error updating the refund status of the item: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

// Handles admin logout
const adminLogout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Error destroying the session: ", error);
      throw new Error("An error occurred. Please try again later.");
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