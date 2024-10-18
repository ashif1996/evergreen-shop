const User = require("../models/user");
const crypto = require("crypto");

// Generate a unique referral code
const generateUniqueReferralCode = async () => {
  let referralCode;
  let exists;
  do {
    referralCode = crypto.randomBytes(4).toString("hex");
    exists = await User.findOne({ referralCode });
  } while (exists);
  return referralCode;
};

// Validate the provided referral code
const validateReferralCode = async (referralCode) => {
  try {
    const referrer = await User.findOne({ referralCode });
    if (!referrer) return { success: false, message: "Invalid referral code." };
    if (!referrer.status)
      return { success: false, message: "Referrer is blocked by the admin." };

    return {
      success: true,
      message: "Referral code verified successfully.",
      referrer
    };
  } catch (err) {
    console.error("Server error: ", err);
    return { success: false, message: "An internal server error occurred." };
  }
};

// Verify referral codes
const verifyReferralCode = async (req, res) => {
  const { referralCode } = req.body;
  try {
    const validationResult = await validateReferralCode(referralCode);
    if (!validationResult.success)
      return res.status(400).json(validationResult);

    res.status(200).json(validationResult);
  } catch (err) {
    console.error("Error verifying referral code: ", err);
    res.status(500).json({
      success: false,
      message: "Server error during referral code verification.",
    });
  }
};

// Credit referral rewards to both the referrer and the new user
const creditReferralReward = async (referrerId, newUser, next) => {
  try {
    const referrer = await User.findById(referrerId);
    if (!referrer) return;

    referrer.wallet = referrer.wallet || { balance: 0, transactions: [] };
    newUser.wallet = newUser.wallet || { balance: 0, transactions: [] };

    referrer.wallet.balance += 250;
    referrer.wallet.transactions.push({
      amount: 250,
      description: `Referral reward from ${newUser.email}`,
      type: "credit",
      status: "completed",
    });

    newUser.wallet.balance += 100;
    newUser.wallet.transactions.push({
      amount: 100,
      description: `Referral bonus for signing up`,
      type: "credit",
      status: "completed",
    });

    await referrer.save();
    await newUser.save();
  } catch (err) {
    console.error("Error updating wallet balances: ", err);
    return next(err);
  }
};

module.exports = {
  generateUniqueReferralCode,
  validateReferralCode,
  verifyReferralCode,
  creditReferralReward,
};