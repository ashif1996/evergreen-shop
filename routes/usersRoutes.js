const express = require('express');
const router = express.Router();
const passport = require('passport'); // Passport for authentication
const userController = require('../controllers/userController'); // User controller
const { isUser, isLoggedIn } = require('../middlewares/authMiddleware'); // User auth middleware
const walletController = require('../utils/paymentServices/walletServices'); // Wallet services
const { signupValidationRules, loginValidationRules } = require('../middlewares/validators/userValidators'); // Validation rules
const { verifyReferralCode } = require('../utils/referralUtils'); // Referral code verification
const validate = require('../middlewares/validate'); // Validation middleware

// Authentication Routes
router.get('/login', userController.getUserLogin); // Get login page
router.post('/login', userController.userLogin); // User login
router.get('/signup', userController.getUserSignup); // Get signup page
router.post('/signup', signupValidationRules, validate, userController.userSignup); // User signup
router.get('/forgot-password', userController.getForgotPassword); // Get forgot password page
router.get('/change-password', userController.getChangePassword); // Get change password page
router.get('/logout', userController.userLogout); // User logout

// Profile Management Routes
router.get('/profile', isUser, isLoggedIn, userController.getUserProfile); // Get user profile
router.get('/editProfile', isUser, isLoggedIn, userController.getEditProfile); // Get edit profile page
router.post('/profile/edit', isUser, isLoggedIn, userController.editProfile); // Edit user profile

// Address Management Routes
router.get('/address-management', isUser, isLoggedIn, userController.getAddressManagement); // Manage addresses
router.post('/address-management/add', isUser, isLoggedIn, userController.addAddress); // Add address
router.post('/address-management/update', isUser, isLoggedIn, userController.addAddress); // Update address (duplicate)
router.post('/address-management/delete', isUser, isLoggedIn, userController.deleteAddress); // Delete address

// Referral Routes
router.post('/referrals/verify', verifyReferralCode); // Verify referral code
router.get('/referrals', isUser, isLoggedIn, userController.getReferrals); // Get referrals

// Shopping Cart Routes
router.get('/shoppingCart', isUser, isLoggedIn, userController.getShoppingCart); // Get shopping cart
router.post('/shoppingCart/add', isUser, isLoggedIn, userController.addProduct); // Add product to cart
router.post('/shoppingCart/update-quantity', isUser, isLoggedIn, userController.updateCartQuantity); // Update cart quantity
router.post('/shoppingCart/delete-item', isUser, isLoggedIn, userController.deleteCartItems); // Delete item from cart

// Wishlist Routes
router.get('/wishlist', isUser, isLoggedIn, userController.getWishlist); // Get wishlist
router.post('/wishlist/add', isUser, isLoggedIn, userController.addToWishlist); // Add to wishlist
router.post('/wishlist/delete/:productId', isUser, isLoggedIn, userController.deleteWishlistItems); // Delete from wishlist

// Wallet Routes
router.get('/wallet', isUser, isLoggedIn, walletController.getWallet); // Get wallet
router.get('/wallet/money/add', isUser, isLoggedIn, walletController.getAddWalletMoney); // Get add money page
router.post('/wallet/money/add/initiate', isUser, isLoggedIn, walletController.initiatePayment); // Initiate wallet payment
router.post('/wallet/money/add/verify', isUser, isLoggedIn, walletController.verifyPayment); // Verify wallet payment

// Google Authentication Routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] })); // Google login
router.get('/auth/google/callback', passport.authenticate('google', { 
    failureRedirect: '/users/login', 
    failureFlash: true 
}), async (req, res) => {
    // Store user info in session after authentication
    req.session.user = {
        _id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        status: req.user.status
    };
    res.redirect('/'); // Redirect to home page
});

/* Routes for Facebook authentication
router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile'] }));
router.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/users/login', successRedirect: '/' }));
*/

module.exports = router; // Export the router