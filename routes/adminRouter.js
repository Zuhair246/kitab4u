const express = require('express')
const router = express.Router()
const adminController = require('../controllers/admin/adminController')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const {userAuth, adminAuth} = require('../middlewares/auth')

//admin authentication
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/', adminAuth, adminController.loadDashboard);
router.post('/logout', adminController.logout)

//customer Controller
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked)
router.get('/unblockCustomer', adminAuth, customerController.customerUnBlocked)

//category Management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post("/editCategory", adminAuth, categoryController.editCategory);
router.post("/deleteCategory", adminAuth, categoryController.deleteCategory);

//Product Management
router.get('addProducts', adminAuth, productController.getProductAddPage)



module.exports = router