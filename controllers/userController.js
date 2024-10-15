const bcrypt = require("bcrypt");
const Address = require("../models/addressSchema");
const Cart = require("../models/cartSchema");
const Product = require("../models/product");
const User = require("../models/user");
const Wishlist = require("../models/wishlistSchema");
const {
  calculateBestDiscountedPrice,
} = require("../utils/discountPriceCalculation");
const {
  creditReferralReward,
  generateReferralCode,
  validateReferralCode,
} = require("../utils/referralUtils");
const errorHandler = require("../utils/errorHandlerUtils");
const successHandler = require("../utils/successHandlerUtils");
const HttpStatus = require("../utils/httpStatus");

// Renders the signup page for users
const getUserSignup = (req, res) => {
  const locals = { title: "Sign up | EverGreen" };

  return res.render("users/signup", {
    locals,
    layout: "layouts/authLayout"
  });
};

// Handles user signup process
const userSignup = async (req, res) => {
  const { firstName, lastName, referralCode, email, password } = req.body;

  try {
    let referrer = null;

    if (referralCode) {
      const validationResult = await validateReferralCode(referralCode);

      if (!validationResult.success) {
        return res.redirect("/users/signup");
      }

      referrer = validationResult.referrer;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "User already exists.");
    }

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      referredBy: referrer ? referrer._id : null
    });

    const user = await newUser.save();
    const generatedReferralCode = generateReferralCode(user._id);
    user.referralCode = generatedReferralCode;
    await user.save();

    if (referrer) {
      await creditReferralReward(referrer._id, user);
    }

    return successHandler(res, HttpStatus.CREATED, "You have registered successfully.");
  } catch (err) {
    console.error("Error registering the user: ", err);
    return next(err);
  }
};

// Renders the login page or redirects if the user is already logged in
const getUserLogin = (req, res) => {
  const locals = { title: "Login | EverGreen" };

  if (req.session && req.session.user) {
    return res.redirect("/");
  } else {
    return res.render("users/login", {
      locals,
      layout: "layouts/authLayout.ejs"
    });
  }
};

// Handles user login process
const userLogin = async (req, res) => {
  const locals = { title: "Login | EverGreen", message: {} };
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, isAdmin: false });
    if (!user) {
      locals.message.error = "User not found. Try again using another account.";
      return res.status(HttpStatus.NOT_FOUND).render("users/login.ejs", {
        locals,
        layout: "layouts/authLayout.ejs"
      });
    }

    if (user.status === false) {
      locals.message.error =
        "You are blocked by the Admin. Try using another account.";
      return res.status(HttpStatus.BAD_REQUEST).render("users/login.ejs", {
        locals,
        layout: "layouts/authLayout.ejs"
      });
    }

    const validatePassword = await bcrypt.compare(password, user.password);
    if (!validatePassword) {
      locals.message.error = "Password does not match. Please try again.";
      return res.status(HttpStatus.BAD_REQUEST).render("users/login.ejs", {
        locals,
        layout: "layouts/authLayout.ejs"
      });
    }

    req.session.user = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status
    };

    return res.redirect("/");
  } catch (err) {
    console.error("An error occurred during login: ", err);
    return next(err);
  }
};

// Renders the forgot password page
const getForgotPassword = (req, res) => {
  const locals = {
    title: `Forgotten Password | Can't Log In | Request OTP | EverGreen`,
  };
  res.render("users/forgot-password", {
    locals,
    layout: "layouts/authLayout",
    csrfToken: req.csrfToken(),
  });
};

// Renders the change password page
const getChangePassword = (req, res) => {
  const locals = { title: `Change Password | Request OTP | EverGreen` };
  res.render("users/change-password", {
    locals,
    layout: "layouts/authLayout",
    csrfToken: req.csrfToken(),
  });
};

// Retrieves and renders the user profile page
const getUserProfile = async (req, res) => {
  const locals = {
    title: "Address Management | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };

  // Redirect if user is not logged in
  if (!locals.isLoggedIn) {
    const errorMessage =
      "You must be logged in to access this page. Return back to login page.";
    return res.redirect(
      `/error?statusCode=401&errorMessage=${encodeURIComponent(errorMessage)}`
    );
  }

  const userId = req.session.user._id;

  try {
    // Fetch user data and populate addresses
    const user = await User.findById(userId).populate("addresses");

    // Redirect if user not found
    if (!user) {
      const errorMessage = "User not found. Try again using another account.";
      return res.redirect(
        `/error?statusCode=404&errorMessage=${encodeURIComponent(errorMessage)}`
      );
    }

    locals.user = user; // Set user data in locals

    // Render the user profile page with addresses
    res.render("users/profile.ejs", {
      locals,
      addresses: user.addresses || [], // Ensure addresses exist
      layout: "layouts/userLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error fetching user profile: ", err);
    const errorMessage =
      "Something went wrong while fetching your profile. Please try again later or contact support if the issue persists.";
    return res.redirect(
      `/error?statusCode=500&errorMessage=${encodeURIComponent(errorMessage)}`
    );
  }
};

// Renders the edit user profile page
const getEditProfile = (req, res) => {
  const locals = {
    title: "Edit User Profile | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false,
  };
  res.render("users/editProfile.ejs", {
    locals,
    layout: "layouts/userLayout",
    csrfToken: req.csrfToken(),
  });
};

// Handles the editing of user profile
const editProfile = async (req, res) => {
  const userId = req.session.user._id; // Get the user ID from the session
  const { firstName, lastName } = req.body; // Destructure input from the request body

  try {
    await User.findByIdAndUpdate(userId, {
      firstName,
      lastName
    });

    // Update the session user info
    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;

    // Return JSON response indicating success
    return res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error(error);
    // Return JSON response indicating error
    return res.json({
      success: false,
      message: "Error updating profile",
    });
  }
};

// Renders the address management page for the logged-in user
const getAddressManagement = async (req, res) => {
  const userId = req.session.user._id; // Get the user ID from the session

  try {
    const user = await User.findById(userId).populate("addresses"); // Fetch user and populate addresses
    const locals = {
      title: "Address Management | EverGreen",
      user: req.session.user,
      addresses: user.addresses || [], // Default to empty array if no addresses
      isLoggedIn: req.session.user ? true : false,
    };
    res.status(200).render("users/addressManagement.ejs", {
      locals,
      layout: "layouts/userLayout",
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error("Error fetching address management:", err);
    res
      .status(500)
      .render("error", { message: "Failed to load address management" });
  }
};

// Adds or updates a user address
const addAddress = async (req, res) => {
  const { addressId, address, city, state, zipCode } = req.body; // Destructure address details
  const userId = req.session.user._id; // Get the user ID from the session

  try {
    // Check if updating an existing address
    if (addressId) {
      const user = await User.findOne({ _id: userId }); // Fetch user

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Update the specified address
      const updatedAddress = await Address.findByIdAndUpdate(
        addressId,
        {
          address,
          city,
          state,
          zipCode,
        },
        { new: true }
      );

      if (!updatedAddress) {
        return res
          .status(404)
          .json({ success: false, message: "Address not found" });
      }

      return res
        .status(200)
        .json({ success: true, message: "Address updated successfully." });
    } else {
      // Adding a new address
      const user = await User.findOne({ _id: userId }); // Fetch user

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Create and save new address
      const newAddress = new Address({
        userId: userId,
        address,
        city,
        state,
        zipCode,
      });

      await newAddress.save(); // Save new address
      user.addresses.push(newAddress._id); // Link new address to user
      await user.save(); // Save user with updated addresses

      res
        .status(200)
        .json({ success: true, message: "Address added successfully" });
    }
  } catch (err) {
    console.error("Internal server error:", err);
    res
      .status(500)
      .json({ success: false, message: "Internal server error occurred." });
  }
};

// Deletes a user's address based on address ID
const deleteAddress = async (req, res) => {
  const { addressId } = req.body; // Get the address ID from the request body
  const userId = req.session.user._id; // Get the user ID from the session

  try {
    // Find the address to delete
    const address = await Address.findById(addressId);
    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found." });
    }

    // Find the user to update their address list
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Remove the address from the user's addresses list
    user.addresses.pull(addressId);
    await user.save(); // Save updated user

    // Delete the address from the database
    await Address.findByIdAndDelete(addressId);

    return res
      .status(200)
      .json({ success: true, message: "Address deleted successfully." });
  } catch (err) {
    console.error("Internal server error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error occurred." });
  }
};

// Retrieves and displays the user's shopping cart
const getShoppingCart = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen", // Set page title
    user: req.session.user, // Get user from session
    isLoggedIn: req.session.user ? true : false, // Check if user is logged in
  };

  try {
    if (!req.session.user) {
      // Render empty cart view for guests
      return res.status(200).render("users/cart.ejs", {
        locals,
        cart: { items: [] },
        layout: "layouts/userLayout",
      });
    }

    const userId = req.session.user._id; // Get user ID from session
    const user = await User.findById(userId); // Find user by ID

    // Find user's cart and populate product and category data
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: {
        path: "category",
        model: "Category",
      },
    });

    if (!cart) {
      // Render empty cart view if cart not found
      return res.status(404).render("users/cart.ejs", {
        locals,
        cart: { items: [] },
        layout: "layouts/userLayout",
      });
    }

    // Calculate discount details for each item in the cart
    cart.items.forEach(async (item) => {
      const product = item.productId;
      const discountDetails = calculateBestDiscountedPrice(product); // Calculate discounts

      // Assign discount details to the item
      item.discountedPrice = discountDetails.discountedPrice;
      item.discountType = discountDetails.discountType;
      item.fixedDiscount = discountDetails.fixedDiscount;
      item.discountPercentage = discountDetails.discountPercentage;
    });

    // Render the cart view with user and cart data
    res.render("users/cart.ejs", {
      locals,
      user: user,
      cart: cart,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    // Handle error and render cart view with error message
    res.status(500).render("users/cart.ejs", {
      locals: { ...locals, cart: null, error: "Internal Server Error" },
      layout: "layouts/userLayout",
    });
  }
};

// Adds a product to the user's shopping cart
const addProduct = async (req, res) => {
  try {
    const userId = req.session.user._id; // Get user ID from session
    const user = await User.findById(userId); // Find the user

    if (!user) {
      // Return error if user not found
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const { productId } = req.body; // Get product ID from request body

    const product = await Product.findById(productId).populate("category"); // Find product
    if (!product) {
      // Return error if product not found
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Check if there's enough stock
    if (product.stock <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Product is out of stock" });
    }

    const { discountedPrice } = calculateBestDiscountedPrice(product); // Get discounted price

    let cart = await Cart.findOne({ userId }); // Find user's cart
    if (!cart) {
      // Create new cart if not found
      cart = new Cart({
        userId,
        items: [],
        subTotal: 0,
        shippingCharge: 30,
        totalPrice: 30,
      });
    }

    const existingItem = cart.items.find((item) =>
      item.productId.equals(productId)
    ); // Check if product already in cart

    if (existingItem) {
      // Check stock for existing item
      if (existingItem.quantity + 1 > product.stock) {
        return res
          .status(400)
          .json({ success: false, message: "Not enough stock available" });
      }

      // Update quantity and total for existing item
      existingItem.quantity += 1;
      existingItem.itemTotal = discountedPrice
        ? discountedPrice * existingItem.quantity
        : existingItem.price * existingItem.quantity;
    } else {
      // Check stock for new item
      if (1 > product.stock) {
        return res
          .status(400)
          .json({ success: false, message: "Not enough stock available" });
      }

      // Add new item to cart
      cart.items.push({
        productId,
        price: product.price,
        quantity: 1,
        itemTotal: discountedPrice ? discountedPrice : product.price,
      });
    }

    // Calculate subtotal and total price
    cart.subTotal = cart.items.reduce((acc, item) => acc + item.itemTotal, 0);
    cart.totalPrice = cart.subTotal + cart.shippingCharge;

    const itemCount = cart.items.reduce((acc, item) => acc + item.quantity, 0); // Count total items

    await cart.save(); // Save cart

    user.cart = cart._id; // Associate cart with user
    await user.save(); // Save user

    // Respond with success and updated cart details
    res.json({
      success: true,
      message: "Product added to cart",
      cart,
      itemCount,
    });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    // Handle error and respond
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Updates the quantity of a product in the user's shopping cart
const updateCartQuantity = async (req, res) => {
  const { productId, quantity } = req.body; // Get product ID and new quantity from request
  const userId = req.session.user._id; // Get user ID from session

  try {
    const cart = await Cart.findOne({ userId }); // Find user's cart

    if (cart) {
      const item = cart.items.find((item) => item.productId.equals(productId)); // Check if item exists in cart

      if (item) {
        const product = await Product.findById(productId).populate("category"); // Find product details

        if (!product) {
          // Return error if product not found
          return res
            .status(404)
            .json({ success: false, message: "Product not found" });
        }

        const { discountedPrice } = calculateBestDiscountedPrice(product); // Get discounted price

        // Check if the desired quantity is available
        if (quantity > product.stock) {
          return res
            .status(400)
            .json({ success: false, message: "Not enough stock available" });
        }

        // Update item quantity and total
        item.quantity = quantity;
        item.itemTotal = discountedPrice * quantity;

        // Recalculate subtotal and total price
        cart.subTotal = cart.items.reduce(
          (acc, item) => acc + item.itemTotal,
          0
        );
        cart.totalPrice = cart.subTotal + cart.shippingCharge;

        await cart.save(); // Save updated cart
        return res.json({
          success: true,
          itemTotal: item.itemTotal, // Return updated item total
          subTotal: cart.subTotal, // Return updated subtotal
          totalPrice: cart.totalPrice, // Return updated total price
        });
      }

      // Return error if item not found in cart
      return res.json({ success: false, message: "Item not found in cart" });
    }

    // Return error if cart not found
    res.json({ success: false, message: "Cart not found" });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    // Handle error and respond
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Deletes a product from the user's shopping cart
const deleteCartItems = async (req, res) => {
  const { productId } = req.body; // Get product ID from request
  const userId = req.session.user._id; // Get user ID from session

  try {
    const cart = await Cart.findOne({ userId }); // Find user's cart

    if (!cart) {
      // Return error if cart not found
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find((item) => item.productId.equals(productId)); // Find item in cart

    if (item) {
      const product = await Product.findById(productId); // Find product details

      if (!product) {
        // Return error if product not found
        return res
          .status(404)
          .json({ success: false, message: "Product not found" });
      }

      const itemIndex = cart.items.findIndex((item) =>
        item.productId.equals(productId)
      ); // Get index of item in cart

      if (itemIndex === -1) {
        // Return error if item not found in cart
        return res
          .status(404)
          .json({ success: false, message: "Product not found in cart" });
      }

      cart.items.splice(itemIndex, 1); // Remove item from cart

      // Recalculate cart totals
      cart.subTotal = cart.items.reduce((acc, item) => acc + item.itemTotal, 0);
      cart.totalPrice = cart.subTotal + cart.shippingCharge;

      await cart.save(); // Save updated cart
      return res.json({
        success: true,
        subTotal: cart.subTotal, // Return updated subtotal
        totalPrice: cart.totalPrice, // Return updated total price
        message: "Product removed from cart",
      });
    }
  } catch (error) {
    console.error("Error deleting cart item:", error);
    // Handle error and respond
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Fetches the user's wishlist and handles pagination
const getWishlist = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false
  };

  try {
    // Check if user is logged in
    if (!locals.isLoggedIn) {
      const errorMessage =
        "You must be logged in to access this page. Return back to login page.";
      return res.redirect(
        `/error?statusCode=401&errorMessage=${encodeURIComponent(errorMessage)}`
      );
    }

    const userId = req.session.user._id;
    const user = await User.findById(userId);

    // Fetch the user's wishlist
    let wishlist = await Wishlist.findOne({ userId }).populate(
      "items.productId"
    );

    if (!wishlist) {
      // Create a new wishlist if not found
      wishlist = new Wishlist({
        userId,
        items: [], // Start with an empty items array
      });
      await wishlist.save(); // Save the new wishlist
    }

    // Only set the wishlist reference if it was newly created
    if (!user.wishlist || user.wishlist.toString() !== wishlist._id.toString()) {
      user.wishlist = wishlist._id;
      await user.save(); // Save the user only if the wishlist reference changed
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = 5;

    // Get total number of items and calculate pagination details
    const totalItems = wishlist.items.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedItems = wishlist.items.slice(
      (page - 1) * limit,
      page * limit
    ); // Paginate items

    res.status(200).render("users/wishlist.ejs", {
      locals,
      wishlist: { ...wishlist.toObject(), items: paginatedItems }, // Return paginated items
      currentPage: page,
      totalPages,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching Wishlist: ", error);
    
    // Handle error and render
    res.status(500).render("users/wishlist.ejs", {
        locals: { ...locals, wishlist: null, error: error.message || "Internal Server Error" },
        layout: "layouts/userLayout",
    });
  }
};

// Adds a product to the user's wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id; // Get user ID from session
    const user = await User.findById(userId); // Find user

    if (!user) {
      // Return error if user not found
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const { productId } = req.body; // Get product ID from request

    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      // Return error if product not found
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    let wishlist = await Wishlist.findOne({ userId }); // Find user's wishlist
    if (!wishlist) {
      // Create a new wishlist if not found
      wishlist = new Wishlist({
        userId,
        items: [],
      });
      await wishlist.save(); // Save the new wishlist immediately
    }

    // Check if product already exists in wishlist
    const existingItem = wishlist.items.find((item) =>
      item.productId.equals(productId)
    );
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Product already exists in your wishlist.",
      });
    }

    wishlist.items.push({ productId }); // Add product to wishlist

    await wishlist.save(); // Save updated wishlist

    // Only update user's wishlist reference if it was a new wishlist
    if (!user.wishlist || user.wishlist.toString() !== wishlist._id.toString()) {
      user.wishlist = wishlist._id; // Update user's wishlist reference
      await user.save(); // Save user
    }

    res
      .status(200)
      .json({ success: true, message: `Product added to your wishlist.` });
  } catch (error) {
    console.error("Error adding product to wishlist: ", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Deletes a product from the user's wishlist
const deleteWishlistItems = async (req, res) => {
  try {
    const userId = req.session.user._id; // Get user ID from session
    const { productId } = req.body; // Get product ID from request

    const wishlist = await Wishlist.findOne({ userId }); // Find user's wishlist

    if (!wishlist) {
      // Return error if wishlist not found
      return res
        .status(404)
        .json({ success: false, message: "Wishlist not found." });
    }

    const item = wishlist.items.find((item) =>
      item.productId.equals(productId)
    ); // Find item in wishlist

    if (item) {
      const product = await Product.findById(productId); // Find product

      if (!product) {
        // Return error if product not found
        return res
          .status(404)
          .json({ success: false, message: "Product not found." });
      }

      const itemIndex = wishlist.items.findIndex((item) =>
        item.productId.equals(productId)
      ); // Get index of item

      if (itemIndex === -1) {
        // Return error if item not found in wishlist
        return res
          .status(404)
          .json({ success: false, message: "Product not found in wishlist" });
      }

      wishlist.items.splice(itemIndex, 1); // Remove item from wishlist
      await wishlist.save(); // Save updated wishlist

      res.status(200).json({
        success: true,
        message: `${product.name} is removed from the wishlist.`,
      });
    }
  } catch (error) {
    console.error("Error deleting wishlist item:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Fetches the referrals of the logged-in user
const getReferrals = async (req, res) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: req.session.user ? true : false, // Check if user is logged in
  };

  try {
    // Redirect to error page if user is not logged in
    if (!locals.isLoggedIn) {
      const errorMessage =
        "You must be logged in to access this page. Return back to login page.";
      return res.redirect(
        `/error?statusCode=401&errorMessage=${encodeURIComponent(errorMessage)}`
      );
    }

    const userId = req.session.user._id; // Get user ID from session

    // Find the logged-in user by their ID
    const user = await User.findById(userId);
    if (!user) {
      // Return error if user not found
      return res.status(404).send("User not found");
    }

    // Find users who were referred by this user
    const referrals = await User.find({ referredBy: user._id });

    // Render the referral page with user data and referrals list
    res.render("users/referrals.ejs", {
      locals,
      user: user,
      referrals: referrals,
      layout: "layouts/userLayout",
      formatDate: (date) => new Date(date).toLocaleDateString(), // Date formatting helper
    });
  } catch (error) {
    console.error("Error fetching referral data:", error);
    res.status(500).send("Server error"); // Handle server error
  }
};

// Logs out the user and redirects to the login page
const userLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying the session:", err);
      return next(err);
    }
    return res.redirect("/users/login");
  });
};

module.exports = {
  getUserSignup,
  userSignup,
  getUserLogin,
  userLogin,
  getForgotPassword,
  getChangePassword,
  getUserProfile,
  getEditProfile,
  editProfile,
  getAddressManagement,
  addAddress,
  deleteAddress,
  getShoppingCart,
  addProduct,
  updateCartQuantity,
  deleteCartItems,
  getWishlist,
  addToWishlist,
  deleteWishlistItems,
  getReferrals,
  userLogout,
};