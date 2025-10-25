const express = require('express')
const router = express.Router()
const adminController = require('../controllers/admin/adminController')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const orderController = require('../controllers/admin/orderController')
const {userAuth, adminAuth} = require('../middlewares/auth');
const uploadImages = require('../middlewares/imgValid')
// const upload = require('../middlewares/upload')

//admin authentication
router.get('/', adminController.loadLogin);
router.post('/', adminController.login);
router.get('/dashboard', adminAuth, adminController.loadDashboard);
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
router.post("/activateCategory",adminAuth, categoryController.activateCategory);


//Product Management
router.get('/listProducts', adminAuth, productController.getProductList)
router.get('/addProducts', adminAuth, productController.getProductAddPage)
router.post('/addProducts', adminAuth, uploadImages, productController.addProduct)
router.get('/editProduct/:id', adminAuth, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth, uploadImages, productController.editProduct)
router.post('/deleteProduct', adminAuth, productController.deleteProduct)

//Order Management
router.get('/userOrders', adminAuth, orderController.orderListing)
router.get('/userOrders/:id', adminAuth,orderController.viewOrderDetails);
router.post('/userOrders/:orderId/updateStatus', adminAuth, orderController.updateOrderStatus);
router.post('/userOrders/:orderId/cancel', adminAuth, orderController.orderCancelRequest);
router.post('/userOrders/:orderId/item/:itemId/cancel', adminAuth, orderController.itemCancelRequest);
router.post('/userOrders/:orderId/return', adminAuth, orderController.orderReturnRequest);
router.post('/userOrders/:orderId/item/:itemId/return', adminAuth, orderController.itemReturnRequest);

// router.post('/userOrders/:orderId/item/:itemId/status', orderController.updateItemStatus);

module.exports = router;