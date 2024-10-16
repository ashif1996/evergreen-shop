const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { isAdmin, isAdminLoggedIn } = require('../middlewares/authMiddleware');

// Routes for sales report functionalities
router.get('/report', isAdmin, isAdminLoggedIn, salesController.getSalesReportPage);
router.get('/report/generate', isAdmin, isAdminLoggedIn, salesController.generateSalesReport);
router.post('/report/download', isAdmin, isAdminLoggedIn, salesController.downloadSalesReport);

module.exports = router;