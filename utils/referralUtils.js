const User = require("../models/user"); // Import User model
const crypto = require("crypto"); // Import crypto for generating referral codes

// Generate a unique referral code
const generateReferralCode = (userId) => {
  return crypto.randomBytes(4).toString("hex"); // Return a 4-byte hex string
};

// Validate the provided referral code
const validateReferralCode = async (referralCode) => {
  try {
    const referrer = await User.findOne({ referralCode }); // Find user by referral code

    if (!referrer) {
      return { success: false, message: "Invalid referral code." }; // Code not found
    }

    if (!referrer.status) {
      return { success: false, message: "Referrer is blocked by the admin." }; // Referrer is blocked
    }

    return {
      success: true,
      message: "Referral code verified successfully.",
      referrer,
    }; // Code is valid
  } catch (error) {
    console.error("An internal server error occurred:", error); // Log error
    return { success: false, message: "An internal server error occurred." }; // Return error message
  }
};

// API handler for verifying referral codes
const verifyReferralCode = async (req, res) => {
  const { referralCode } = req.body; // Extract referral code from request body

  try {
    const validationResult = await validateReferralCode(referralCode); // Validate the code

    if (!validationResult.success) {
      return res.status(400).json(validationResult); // Return error if validation fails
    }

    res.status(200).json(validationResult); // Return success response
  } catch (error) {
    console.error("Error verifying referral code:", error); // Log error
    res
      .status(500)
      .json({
        success: false,
        message: "Server error during referral code verification.",
      }); // Return server error
  }
};

// Credit referral rewards to both the referrer and the new user
const creditReferralReward = async (referrerId, newUser) => {
  console.log("creditReferralReward function called");
  console.log("Referrer ID:", referrerId);
  console.log("New User:", newUser);

  try {
    const referrer = await User.findById(referrerId); // Find the referrer by ID
    if (!referrer) {
      console.error("Referrer not found"); // Log if referrer does not exist
      return;
    }

    // Initialize wallets if they don't exist
    referrer.wallet = referrer.wallet || { balance: 0, transactions: [] };
    newUser.wallet = newUser.wallet || { balance: 0, transactions: [] };

    // Update referrer's wallet
    referrer.wallet.balance += 250; // Add reward
    referrer.wallet.transactions.push({
      amount: 250,
      description: `Referral reward from ${newUser.email}`, // Transaction description
      type: "credit",
      status: "completed",
    });

    // Update new user's wallet
    newUser.wallet.balance += 100; // Add sign-up bonus
    newUser.wallet.transactions.push({
      amount: 100,
      description: `Referral bonus for signing up`, // Transaction description
      type: "credit",
      status: "completed",
    });

    // Save updated user documents
    await referrer.save();
    await newUser.save();

    // Log state after updates
    console.log("Referrer after update:", referrer.wallet);
    console.log("New user after update:", newUser.wallet);
  } catch (error) {
    console.error("Error updating wallet balances:", error); // Log error
    throw error; // Propagate the error
  }
};

module.exports = {
  generateReferralCode,
  validateReferralCode,
  verifyReferralCode,
  creditReferralReward, // Export functions for referral management
};