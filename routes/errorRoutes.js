const express = require('express');
const router = express.Router();

// Render admin error messages
router.get('/admin-error', (req, res) => {
    const { statusCode, errorMessage } = req.query;
    const status = parseInt(statusCode, 10) || 500; // Default to 500 if no statusCode

    res.status(status).render('adminErrorMessages.ejs', {
        locals: {
            title: 'Error occurred | EverGreen', // Page title
            message: { error: errorMessage || 'An unexpected error occurred. Please try again later.' }, // Error message
        },
        layout: 'layouts/errorMessagesLayout.ejs', // Layout for the error page
        csrfToken: req.csrfToken() // CSRF token for security
    });
});

// Render user error messages
router.get('/user-error', (req, res) => {
    const { statusCode, errorMessage } = req.query;
    const status = parseInt(statusCode, 10) || 500; // Default to 500 if no statusCode

    res.status(status).render('userErrorMessages.ejs', {
        locals: {
            title: 'Error occurred | EverGreen', // Page title
            message: { error: errorMessage || 'An unexpected error occurred. Please try again later.' }, // Error message
        },
        layout: 'layouts/errorMessagesLayout.ejs', // Layout for the error page
        csrfToken: req.csrfToken() // CSRF token for security
    });
});

module.exports = router; // Export the router