// Import environment configuration
require('dotenv').config();

// Import custom modules
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

// Import core Node.js modules
const path = require('path');

// Import third-party modules
const express = require('express');

// Security-related modules
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cors = require('cors');
const csrf = require('csurf');
const nocache = require('nocache');

// Parsing and session management modules
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');

// Templating and layout modules
const expressLayouts = require('express-ejs-layouts');

// Authentication and logging modules
const passport = require('./config/passport');
const morgan = require('morgan');
const createError = require('http-errors');

// Initialize Express app
const app = express();

const setCartAndWishlistCounts = require('./middlewares/setCartWishlistCounts');

// Middleware configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        ttl: 1 * 24 * 60 * 60 // Session will expire in 1 day (seconds)
    }),
    cookie: {
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production'
    }
}));

app.use(mongoSanitize());
app.use(hpp());
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(flash());

const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Middleware to set locals.isLoggedIn
app.use((req, res, next) => {
    res.locals.isLoggedIn = req.session.user ? true : false;
    next();
});

app.use(['/' ,'/users', '/products', '/orders'], setCartAndWishlistCounts);

app.use(express.static(path.join(__dirname, 'public')));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

app.use(morgan('dev'));

app.use(passport.initialize());
app.use(passport.session());

// Apply nocache middleware to all routes
app.use(nocache());

// Import routes
const indexRoutes = require('./routes/indexRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/usersRoutes');
const otpRoutes = require('./routes/otpRoutes');
const productRoutes = require('./routes/productsRoutes');
const orderRoutes = require('./routes/ordersRoutes');
const salesRoutes = require('./routes/salesRoutes');
const errorRoutes = require('./routes/errorRoutes');

// Use routes
app.use('/', indexRoutes);
app.use('/admin', adminRoutes);
app.use('/users', userRoutes);
app.use('/otp', otpRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/sales', salesRoutes);
app.use('/error', errorRoutes);

// Example route to trigger a 500 Internal Server Error
app.get('/trigger-error', (req, res) => {
    throw new Error('This is a test error!');
});

// 404 Handler - this will catch all unmatched routes
app.use((req, res, next) => {
    res.status(404).render('notFoundError.ejs', {
        title: '404 - Not Found',
        message: undefined,
        layout: 'layouts/errorMessagesLayout.ejs'
    });
});

// Global Error Handler - handles any internal server errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).render('internalError.ejs', {
        title: '500 - Internal Server Error',
        layout: 'layouts/errorMessagesLayout.ejs',
        errorMessage: err.message,
    });
});

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;