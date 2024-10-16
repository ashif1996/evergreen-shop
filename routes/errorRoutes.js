const express = require('express');
const router = express.Router();

// Render admin error messages
router.get('/admin-error', (req, res) => {
    const { statusCode, errorMessage } = req.query;
    const status = parseInt(statusCode, 10) || 500;

    return res.status(status).render('adminErrorMessages.ejs', {
        locals: {
            title: 'Error occurred | EverGreen',
            message: { error: errorMessage || 'An unexpected error occurred. Please try again later.' },
        },
        layout: 'layouts/errorMessagesLayout.ejs',
        csrfToken: req.csrfToken()
    });
});

// Render user error messages
router.get('/user-error', (req, res) => {
    const { statusCode, errorMessage } = req.query;
    const status = parseInt(statusCode, 10) || 500;

    return res.status(status).render('userErrorMessages.ejs', {
        locals: {
            title: 'Error occurred | EverGreen',
            message: { error: errorMessage || 'An unexpected error occurred. Please try again later.' },
        },
        layout: 'layouts/errorMessagesLayout.ejs',
        csrfToken: req.csrfToken()
    });
});

module.exports = router;