const express = require('express');
const router = express.Router();
const passport = require('passport');

const userController = require('../controllers/userController');
const walletController = require('../utils/paymentServices/walletServices');

const { isUser, isLoggedIn } = require('../middlewares/authMiddleware');
const { signupValidationRules } = require('../middlewares/validators/userValidators');
const { verifyReferralCode } = require('../utils/referralUtils');
const validate = require('../middlewares/validate');

// Authentication Routes
router.route("/login")
    .get(userController.getUserLogin)
    .post(userController.userLogin);

router.route("/signup")
    .get(userController.getUserSignup)
    .post(signupValidationRules, validate, userController.userSignup);

router.get('/forgot-password', userController.getForgotPassword);
router.get('/change-password', userController.getChangePassword);

router.get('/logout', userController.userLogout);

// Profile Management Routes
router.get('/profile', isUser, isLoggedIn, userController.getUserProfile);
router.get('/editProfile', isUser, isLoggedIn, userController.getEditProfile);
router.post('/profile/edit', isUser, isLoggedIn, userController.editProfile);

// Address Management Routes
router.get('/address-management', isUser, isLoggedIn, userController.getAddressManagement);
router.post('/address-management/add', isUser, isLoggedIn, userController.addAddress);
router.post('/address-management/update', isUser, isLoggedIn, userController.addAddress);
router.post('/address-management/delete', isUser, isLoggedIn, userController.deleteAddress);

// Referral Routes
router.post('/referrals/verify', verifyReferralCode);
router.get('/referrals', isUser, isLoggedIn, userController.getReferrals);

// Shopping Cart Routes
router.get('/shoppingCart', isUser, isLoggedIn, userController.getShoppingCart);
router.post('/shoppingCart/add', isUser, isLoggedIn, userController.addProduct);
router.post('/shoppingCart/update-quantity', isUser, isLoggedIn, userController.updateCartQuantity);
router.post('/shoppingCart/delete-item', isUser, isLoggedIn, userController.deleteCartItems);

// Wishlist Routes
router.get('/wishlist', isUser, isLoggedIn, userController.getWishlist);
router.post('/wishlist/add', isUser, isLoggedIn, userController.addToWishlist);
router.post('/wishlist/delete/:productId', isUser, isLoggedIn, userController.deleteWishlistItems);

// Wallet Routes
router.get('/wallet', isUser, isLoggedIn, walletController.getWallet);
router.get('/wallet/money/add', isUser, isLoggedIn, walletController.getAddWalletMoney);
router.post('/wallet/money/add/initiate', isUser, isLoggedIn, walletController.initiatePayment);
router.post('/wallet/money/add/verify', isUser, isLoggedIn, walletController.verifyPayment);

// Google Authentication Routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { 
    failureRedirect: '/users/login', 
    failureFlash: true 
}), async (req, res) => {
    req.session.user = {
        _id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        status: req.user.status
    };
    
    return res.redirect('/');
});

/* Routes for Facebook authentication
router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile'] }));
router.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/users/login', successRedirect: '/' }));
*/

module.exports = router;