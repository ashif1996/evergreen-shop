const express = require('express');
const router = express.Router();
const { checkLoginStatus } = require('../middlewares/checkLoginStatus');

const indexController = require('../controllers/indexController');

// Home routes
router.get('/', checkLoginStatus, indexController.getHome);
router.get('/search', indexController.searchProducts);

module.exports = router;