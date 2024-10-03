const User = require("../models/user");

// Function to get cart and wishlist items count
const getUserCartAndWishlistCount = async (userId) => {
  try {
    // Fetch user and populate cart and wishlist
    const user = await User.findById(userId)
      .populate({
        path: "cart",
        populate: { path: "items" },
      })
      .populate({
        path: "wishlist",
        populate: { path: "items" },
      });

    if (user.cart && user.cart.items) {
      console.log("Cart items:", user.cart.items.length);
    }

    if (user.wishlist && user.wishlist.items) {
      console.log("Wishlist items:", user.wishlist.items.length);
    }

    return {
      cartItemsCount: user.cart ? user.cart.items.length : 0,
      wishlistItemsCount: user.wishlist ? user.wishlist.items.length : 0,
    };
  } catch (err) {
    console.error("Error fetching user cart and wishlist:", err);
  }
};

module.exports = getUserCartAndWishlistCount;