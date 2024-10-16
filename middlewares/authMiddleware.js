const User = require("../models/user");

// Middleware to check user authentication
const isUser = async (req, res, next) => {
  try {
    if (!req.session.user) {
      const errorMessage =
        "You need to log in to access this page. Please log in or return to the homepage.";
      return res.redirect(
        `/error/user-error?statusCode=401&errorMessage=${encodeURIComponent(
          errorMessage
        )}`
      );
    }

    if (req.session.user.isAdmin) {
      const errorMessage =
        "Access denied. This page is only for regular users. Please log in with valid user credentials or return to the homepage.";
      return res.redirect(
        `/error/user-error?statusCode=401&errorMessage=${encodeURIComponent(
          errorMessage
        )}`
      );
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      const errorMessage =
        "User not found. Try again using another account or return to the homepage.";
      return res.redirect(
        `/error/user-error?statusCode=401&errorMessage=${encodeURIComponent(
          errorMessage
        )}`
      );
    }

    if (user.status === false) {
      req.session.user = null;
      const errorMessage =
        "You are blocked by the Admin. Try again using another account or return to the homepage.";
      return res.redirect(
        `/error/user-error?statusCode=401&errorMessage=${encodeURIComponent(
          errorMessage
        )}`
      );
    }

    next();
  } catch (err) {
    console.error("An error occurred while checking authentication: ", err);
    return next(err);
  }
};

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    const errorMessage =
      "You must be logged in to access this page. Try again after login or return to the homepage.";
    return res.redirect(
      `/error/user-error?statusCode=401&errorMessage=${encodeURIComponent(
        errorMessage
      )}`
    );
  }
};

// Middleware to check if user is an admin
const isAdmin = async (req, res, next) => {
  if (!req.session.admin) {
    const errorMessage =
      "You must be logged in to access this page. Return back to login page.";
    return res.redirect(
      `/error/admin-error?statusCode=401&errorMessage=${encodeURIComponent(
        errorMessage
      )}`
    );
  }

  // Check if user has admin privileges
  if (!req.session.admin.isAdmin) {
    const errorMessage = "Access denied. Admin privileges required.";
    return res.redirect(
      `/error/admin-error?statusCode=401&errorMessage=${encodeURIComponent(
        errorMessage
      )}`
    );
  }

  next();
};

// Middleware to check if admin is logged in
const isAdminLoggedIn = (req, res, next) => {
  if (req.session && req.session.admin) {
    next();
  } else {
    const errorMessage =
      "You must be logged in to access this page. Return back to login page.";
    return res.redirect(
      `/error/admin-error?statusCode=401&errorMessage=${encodeURIComponent(
        errorMessage
      )}`
    );
  }
};

module.exports = {
  isUser,
  isLoggedIn,
  isAdmin,
  isAdminLoggedIn
};