const checkLoginStatus = (req, res, next) => {
  res.locals.isLoggedIn = !!req.session.user;
  next();
};

module.exports = {
  checkLoginStatus
};