const bcrypt = require("bcrypt");
const Address = require("../models/addressSchema");
const Cart = require("../models/cartSchema");
const Product = require("../models/product");
const User = require("../models/user");
const Wishlist = require("../models/wishlistSchema");
const { calculateBestDiscountedPrice } = require("../utils/discountPriceCalculation");
const {
  creditReferralReward,
  generateUniqueReferralCode,
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
    layout: "layouts/authLayout",
  });
};

// Handles user signup process
const userSignup = async (req, res, next) => {
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
      referredBy: referrer ? referrer._id : null,
    });

    const user = await newUser.save();
    const generatedReferralCode = generateUniqueReferralCode();
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
      layout: "layouts/authLayout",
    });
  }
};

// Handles user login process
const userLogin = async (req, res, next) => {
  const locals = { title: "Login | EverGreen", message: {} };
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, isAdmin: false });
    if (!user) {
      locals.message.error = "User not found. Try again using another account.";

      return res.status(HttpStatus.NOT_FOUND).render("users/login", {
        locals,
        layout: "layouts/authLayout",
      });
    }

    if (user.status === false) {
      locals.message.error = "You are blocked by the Admin. Try using another account.";

      return res.status(HttpStatus.BAD_REQUEST).render("users/login", {
        locals,
        layout: "layouts/authLayout",
      });
    }

    const validatePassword = await bcrypt.compare(password, user.password);
    if (!validatePassword) {
      locals.message.error = "Password does not match. Please try again.";

      return res.status(HttpStatus.BAD_REQUEST).render("users/login", {
        locals,
        layout: "layouts/authLayout",
      });
    }

    req.session.user = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
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

  return res.render("users/forgot-password", {
    locals,
    layout: "layouts/authLayout",
  });
};

// Renders the change password page
const getChangePassword = (req, res) => {
  const locals = { title: `Change Password | Request OTP | EverGreen` };

  return res.render("users/change-password", {
    locals,
    layout: "layouts/authLayout",
  });
};

// Retrieves and renders the user profile page
const getUserProfile = async (req, res, next) => {
  const locals = {
    title: "User Profile | EverGreen",
    user: null,
    isLoggedIn: !!req.session.user,
  };

  const userId = req.session.user._id;

  try {
    const user = await User.findById(userId).populate("addresses");
    if (!user) {
      const errorMessage = "User not found. Try again using another account.";
      return res.redirect(`/error?statusCode=404&errorMessage=${encodeURIComponent(errorMessage)}`);
    }

    locals.user = user;

    return res.render("users/profile", {
      locals,
      addresses: user.addresses || [],
      layout: "layouts/userLayout",
    });
  } catch (err) {
    console.error("Error fetching user profile: ", err);
    return next(err);
  }
};

// Renders the edit user profile page
const getEditProfile = (req, res) => {
  const locals = {
    title: "Edit User Profile | EverGreen",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };

  return res.render("users/editProfile", {
    locals,
    layout: "layouts/userLayout",
  });
};

// Handles the editing of user profile
const editProfile = async (req, res, next) => {
  const userId = req.session.user._id;
  const { firstName, lastName } = req.body;

  try {
    await User.findByIdAndUpdate(userId, {
      firstName,
      lastName,
    });

    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;

    return successHandler(res, HttpStatus.OK, "Profile updated successfully.");
  } catch (err) {
    console.error("Error updating user profile: ", err);
    return next(err);
  }
};

// Renders the address management page for the logged-in user
const getAddressManagement = async (req, res, next) => {
  const locals = {
    title: "Address Management | EverGreen",
    user: req.session.user,
    addresses: [],
    isLoggedIn: !!req.session.user,
  };

  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId).populate("addresses");

    locals.addresses = user.addresses;

    return res.render("users/addressManagement", {
      locals,
      layout: "layouts/userLayout",
    });
  } catch (err) {
    console.error("Error fetching address management: ", err);
    return next(err);
  }
};

// Adds or updates a user address
const addAddress = async (req, res, next) => {
  const { addressId, address, city, state, zipCode } = req.body;
  const userId = req.session.user._id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
    }

    if (addressId) {
      const updatedAddress = await Address.findByIdAndUpdate(
        addressId,
        { address, city, state, zipCode },
        { new: true },
      );

      if (!updatedAddress) {
        return errorHandler(res, HttpStatus.NOT_FOUND, "Address not found.");
      }

      return successHandler(res, HttpStatus.OK, "Address updated successfully.");
    } else {
      // Create and save new address
      const newAddress = new Address({
        userId,
        address,
        city,
        state,
        zipCode,
      });

      await newAddress.save();
      user.addresses.push(newAddress._id);
      await user.save();

      return successHandler(res, HttpStatus.OK, "Address added successfully.");
    }
  } catch (err) {
    console.error("Error adding or updating address: ", err);
    return next(err);
  }
};

// Deletes a user's address
const deleteAddress = async (req, res, next) => {
  const { addressId } = req.body;
  const userId = req.session.user._id;

  try {
    const address = await Address.findById(addressId);
    if (!address) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Address not found.");
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
    }

    user.addresses.pull(addressId);
    await user.save();
    await Address.findByIdAndDelete(addressId);

    return successHandler(res, HttpStatus.OK, "Address deleted successfully.");
  } catch (err) {
    console.error("Error deleting the address: ", err);
    return next(err);
  }
};

// Retrieves and displays the user's shopping cart
const getShoppingCart = async (req, res, next) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };

  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);

    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: {
        path: "category",
        model: "Category",
      }
    });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        subTotal: 0,
        shippingCharge: 30,
        totalPrice: 30,
      });
      await cart.save();
    }

    // Only set the cart reference if it was newly created
    if (!user.cart || user.cart.toString() !== cart._id.toString()) {
      user.cart = cart._id;
      await user.save();
    }

    cart.items.forEach(async (item) => {
      const product = item.productId;
      const discountDetails = calculateBestDiscountedPrice(product);
      item.discountedPrice = discountDetails.discountedPrice;
      item.discountType = discountDetails.discountType;
      item.fixedDiscount = discountDetails.fixedDiscount;
      item.discountPercentage = discountDetails.discountPercentage;
    });

    return res.render("users/cart", {
      locals,
      user: user,
      cart: cart,
      layout: "layouts/userLayout",
    });
  } catch (err) {
    console.error("Error fetching cart: ", err);
    return next(err);
  }
};

// Adds a product to the user's shopping cart
const addProduct = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
    }

    const { productId } = req.body;
    const product = await Product.findById(productId).populate("category");
    if (!product) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found.");
    }
    if (product.stock === 0) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Product is out of stock.");
    }

    const { discountedPrice } = calculateBestDiscountedPrice(product);

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        subTotal: 0,
        shippingCharge: 30,
        totalPrice: 30,
      });
      await cart.save()
      user.cart = cart._id;
      await user.save();
    }

    const existingItem = cart.items.find((item) => item.productId.equals(productId));
    if (existingItem) {
      if (existingItem.quantity + 0.5 > product.stock) {
        return errorHandler(res, HttpStatus.BAD_REQUEST, "Not enough stock available.");
      }
      existingItem.quantity += 0.5;
      existingItem.itemTotal = discountedPrice ? discountedPrice * existingItem.quantity : existingItem.price * existingItem.quantity;
    } else {
      if (1 > product.stock) {
        return errorHandler(res, HttpStatus.BAD_REQUEST, "Not enough stock available.");
      }

      cart.items.push({
        productId,
        price: product.price,
        quantity: 1,
        itemTotal: discountedPrice ? discountedPrice : product.price,
      });
    }

    cart.subTotal = cart.items.reduce((acc, item) => acc + item.itemTotal, 0);
    cart.totalPrice = cart.subTotal + cart.shippingCharge;
    const itemCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);

    await cart.save();

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Product added to cart.",
      cart,
      itemCount,
    });
  } catch (err) {
    console.error("Error adding product to cart: ", err);
    return next(err);
  }
};

// Updates the quantity of a product in the user's shopping cart
const updateCartQuantity = async (req, res, next) => {
  const { productId, quantity } = req.body;
  const userId = req.session.user._id;

  try {
    const cart = await Cart.findOne({ userId });
    if (cart) {
      const item = cart.items.find((item) => item.productId.equals(productId));
      if (item) {
        const product = await Product.findById(productId).populate("category");
        if (!product) {
          return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found.");
        }

        const { discountedPrice } = calculateBestDiscountedPrice(product);

        if (quantity > product.stock) {
          return errorHandler(res, HttpStatus.BAD_REQUEST, "Not enough stock available.");
        }

        item.quantity = quantity;
        item.itemTotal = discountedPrice * quantity;
        cart.subTotal = cart.items.reduce((acc, item) => acc + item.itemTotal, 0);
        cart.totalPrice = cart.subTotal + cart.shippingCharge;

        await cart.save();

        return res.status(HttpStatus.OK).json({
          success: true,
          itemTotal: item.itemTotal,
          subTotal: cart.subTotal,
          totalPrice: cart.totalPrice,
        });
      }

      return errorHandler(res, HttpStatus.NOT_FOUND, "Item not found in cart.");
    }
    return errorHandler(res, HttpStatus.NOT_FOUND, "Cart not found.");
  } catch (err) {
    console.error("Error updating cart quantity: ", err);
    return next(err);
  }
};

// Deletes a product from the user's shopping cart
const deleteCartItems = async (req, res, next) => {
  const { productId } = req.body;
  const userId = req.session.user._id;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Cart not found.");
    }

    const item = cart.items.find((item) => item.productId.equals(productId));
    if (item) {
      const product = await Product.findById(productId);
      if (!product) {
        return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found.");
      }

      const itemIndex = cart.items.findIndex((item) => item.productId.equals(productId));
      if (itemIndex === -1) {
        return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found in cart.");
      }

      cart.items.splice(itemIndex, 1);
      cart.subTotal = cart.items.reduce((acc, item) => acc + item.itemTotal, 0);
      cart.totalPrice = cart.subTotal + cart.shippingCharge;

      await cart.save();

      return res.status(HttpStatus.OK).json({
        success: true,
        subTotal: cart.subTotal,
        totalPrice: cart.totalPrice,
        message: "Product removed from your cart.",
      });
    }
  } catch (err) {
    console.error("Error deleting cart item: ", err);
    return next(err);
  }
};

// Fetches the user's wishlist and handles pagination
const getWishlist = async (req, res, next) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };

  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);

    let wishlist = await Wishlist.findOne({ userId }).populate("items.productId");
    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        items: [],
      });
      await wishlist.save();
    }

    // Only set the wishlist reference if it was newly created
    if (!user.wishlist || user.wishlist.toString() !== wishlist._id.toString()) {
      user.wishlist = wishlist._id;
      await user.save();
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = 5;
    const totalItems = wishlist.items.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedItems = wishlist.items.slice((page - 1) * limit, page * limit);

    return res.render("users/wishlist", {
      locals,
      wishlist: { ...wishlist, items: paginatedItems },
      currentPage: page,
      totalPages,
      layout: "layouts/userLayout",
    });
  } catch (error) {
    console.error("Error fetching Wishlist: ", error);
    return next(err);
  }
};

// Adds a product to the user's wishlist
const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
    }

    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found.");
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        items: [],
      });
      await wishlist.save();
      user.wishlist = wishlist._id;
      await user.save();
    }

    const existingItem = wishlist.items.find((item) => item.productId.equals(productId));
    if (existingItem) {
      return errorHandler(res, HttpStatus.BAD_REQUEST, "Product already exists in your wishlist.");
    }

    wishlist.items.push({ productId });
    await wishlist.save();

    return successHandler(res, HttpStatus.OK, `Product added to your wishlist.`);
  } catch (err) {
    console.error("Error adding product to wishlist: ", err);
    return next(err);
  }
};

// Deletes a product from the user's wishlist
const deleteWishlistItems = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { productId } = req.body;

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "Wishlist not found.");
    }

    const item = wishlist.items.find((item) => item.productId.equals(productId));
    if (item) {
      const product = await Product.findById(productId);
      if (!product) {
        return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found.");
      }

      const itemIndex = wishlist.items.findIndex((item) => item.productId.equals(productId));
      if (itemIndex === -1) {
        return errorHandler(res, HttpStatus.NOT_FOUND, "Product not found in wishlist.");
      }

      wishlist.items.splice(itemIndex, 1);
      await wishlist.save();

      return successHandler(res, HttpStatus.OK, `${product.name} is removed from the wishlist.`);
    }
  } catch (err) {
    console.error("Error deleting wishlist item: ", err);
    return next(err);
  }
};

// Fetches the referrals of the logged-in user
const getReferrals = async (req, res, next) => {
  const locals = {
    title: "Shopping Cart | EverGreen",
    user: req.session.user,
    isLoggedIn: !!req.session.user,
  };

  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return errorHandler(res, HttpStatus.NOT_FOUND, "User not found.");
    }

    const referrals = await User.find({ referredBy: user._id });

    return res.render("users/referrals", {
      locals,
      user: user,
      referrals: referrals,
      layout: "layouts/userLayout",
      formatDate: (date) => new Date(date).toLocaleDateString(),
    });
  } catch (err) {
    console.error("Error fetching referral data: ", err);
    return next(err);
  }
};

// Logs out the user and redirects to the login page
const userLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying the session: ", err);
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