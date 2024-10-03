const getUserCartAndWishlistCount = require("../utils/wishlistAndCartUtils");

const setCartAndWishlistCounts = async (req, res, next) => {
  if (req.session.user) {
    const userId = req.session.user._id;
    const { cartItemsCount, wishlistItemsCount } = await getUserCartAndWishlistCount(
      userId
    );
    res.locals.cartItemsCount = cartItemsCount;
    res.locals.wishlistItemsCount = wishlistItemsCount;
  } else {
    res.locals.cartItemsCount = 0;
    res.locals.wishlistItemsCount = 0;
  }
  next();
};

module.exports = setCartAndWishlistCounts;