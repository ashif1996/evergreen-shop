const User = require("../models/user");

// Function to get cart and wishlist items count
const getUserCartAndWishlistCount = async (userId) => {
  try {
    const user = await User.findById(userId)
      .populate({
        path: "cart",
        populate: { path: "items" },
      })
      .populate({
        path: "wishlist",
        populate: { path: "items" },
      });

    return {
      cartItemsCount: user.cart ? user.cart.items.length : 0,
      wishlistItemsCount: user.wishlist ? user.wishlist.items.length : 0,
    };
  } catch (error) {
    console.error("Error fetching user cart and wishlist: ", error);
    throw new Error("An error occurred. Please try again later.");
  }
};

module.exports = getUserCartAndWishlistCount;