const passport = require("passport");
const crypto = require("crypto");
const googleStrategy = require("passport-google-oauth20").Strategy;
const facebookStrategy = require("passport-facebook");
const User = require("../models/user");
const { generateReferralCode } = require("../utils/referralUtils");

// Function to generate a temporary 8-character alphanumeric password
function generateTemporaryPassword() {
  const temporaryPassword = crypto.randomBytes(4).toString("hex").toUpperCase();
  return temporaryPassword;
}

// Google OAuth 2.0 strategy setup
passport.use(
  new googleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://theevergreen.shop/users/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        // Check if user with Google ID exists
        let user = await User.findOne({ googleId: profile.id });

        // If user doesn't exist, check if email is registered in the database
        if (!user) {
          const existingUser = await User.findOne({
            email: profile.emails[0].value,
          });

          // If email exists, link Google account to this user
          if (existingUser) {
            existingUser.googleId = profile.id;
            user = await existingUser.save();
          } else {
            // If no user exists, create a new user with a temporary password
            const temporaryPassword = generateTemporaryPassword();
            user = new User({
              googleId: profile.id,
              email: profile.emails[0].value,
              firstName: profile.name.givenName,
              lastName: profile.name.familyName,
              password: temporaryPassword
            });

            const savedUser = await user.save();
            const generatedReferralCode = generateReferralCode(savedUser._id);
            savedUser.referralCode = generatedReferralCode;
            await savedUser.save();
          }
        }

        cb(null, user);
      } catch (err) {
        cb(err, null);
      }
    }
  )
);

/* Facebook OAuth strategy (commented out, can be enabled when needed) 
passport.use(new facebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,  // Facebook App ID
    clientSecret: process.env.FACEBOOK_APP_SECRET,  // Facebook App Secret
    callbackURL: '/users/auth/facebook/callback',  // Facebook OAuth callback URL
    profileFields: ['id', 'emails', 'name']  // Requested profile fields
}, async (accessToken, refreshToken, profile, cb) => {
    try {
        // Check if user with Facebook ID exists
        let user = await User.findOne({ facebookId: profile.id });

        // If user doesn't exist, check if email is registered in the database
        if (!user) {
            const existingUser = await User.findOne({ email: profile.emails[0].value });

            // If email exists, link Facebook account to this user
            if(existingUser) {
                existingUser.facebookId = profile.id;
                user = await existingUser.save();
            } else {
                // If no user exists, create a new user with a temporary password
                const temporaryPassword = generateTemporaryPassword();
                user = new User({
                    facebookId: profile.id,
                    email: profile.emails[0].value,
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName,
                    password: temporaryPassword
                });

                await user.save();
            }
        }
        
        cb(null, user);  // Return user through the callback
    } catch (err) {
        cb(err, null);  // Handle error
    }
}));
*/

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session by fetching from database
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user); // Return user
  } catch (err) {
    done(null, err); // Handle error
  }
});

module.exports = passport;