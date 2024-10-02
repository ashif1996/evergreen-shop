const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController'); // Sales controller
const { isAdmin, isAdminLoggedIn } = require('../middlewares/authMiddleware'); // Admin authentication middleware

// Routes for sales report functionalities
router.get('/report', isAdmin, isAdminLoggedIn, salesController.getSalesReportPage); // Get sales report page
router.get('/report/generate', isAdmin, isAdminLoggedIn, salesController.generateSalesReport); // Generate sales report
router.post('/report/download', isAdmin, isAdminLoggedIn, salesController.downloadSalesReport); // Download sales report

module.exports = router; // Export the router