const checkLoginStatus = (req, res, next) => {
  // Set login status in locals
  res.locals.isLoggedIn = !!req.session.user;
  next(); // Proceed to next middleware
};

module.exports = {
  checkLoginStatus,
};