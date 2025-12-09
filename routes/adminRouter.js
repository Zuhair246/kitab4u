const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponController");
const productOfferController = require("../controllers/admin/productOfferController");
const salesController = require('../controllers/admin/salesController');
const dashboardController = require ('../controllers/admin/dashboardController');
const { adminAuth } = require("../middlewares/adminAuth");
const uploadImages = require("../middlewares/imgValid");
const couponValidator = require("../middlewares/couponValidator");
// const upload = require('../middlewares/upload')

//admin authentication
router.get("/", adminController.loadLogin);
router.post("/", adminController.login);
router.post("/logout", adminController.logout);

//customer Controller
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerUnBlocked);

//category Management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post("/editCategory", adminAuth, categoryController.editCategory);
router.post("/deleteCategory", adminAuth, categoryController.deleteCategory);
router.post("/activateCategory", adminAuth, categoryController.activateCategory);

//Product Management
router.get("/listProducts", adminAuth, productController.getProductList);
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, uploadImages, productController.addProduct);
router.get("/editProduct/:id", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploadImages, productController.editProduct);
router.post("/deleteProduct", adminAuth, productController.deleteProduct);

//Order Management
router.get("/userOrders", adminAuth, orderController.orderListing);
router.get("/userOrders/:id", adminAuth, orderController.viewOrderDetails);
router.post("/userOrders/:orderId/updateStatus", adminAuth, orderController.updateOrderStatus);
router.post("/userOrders/:orderId/return", adminAuth, orderController.orderReturnRequest);
router.post("/userOrders/:orderId/item/:itemId/return", adminAuth, orderController.itemReturnRequest);

//Coupon Management
router.get("/coupons", adminAuth, couponController.loadCoupons);
router.post("/coupons/add", adminAuth, couponValidator, couponController.addCoupon);
router.post("/coupons/edit/:id", adminAuth, couponValidator, couponController.editCoupon);
router.post("/coupons/delete/:id", adminAuth, couponController.deleteCoupon);
router.post("/coupons/activate/:id", adminAuth, couponController.activateCoupon);

//Product offer managment
router.get("/productOffers", adminAuth, productOfferController.loadProductOffers);
router.post("/productOffers/add", adminAuth, productOfferController.addProductOffer);
router.post("/productOffers/edit", adminAuth, productOfferController.editProductOffer);
router.post("/productOffers/:offerId/activate", adminAuth, productOfferController.activateProductOffer);
router.post("/productOffers/:offerId/deactivate", adminAuth, productOfferController.deactivateProductOffer);

//Sales Report
router.get('/salesReport', adminAuth, salesController.loadSales);
router.post('/salesReport', adminAuth, salesController.filterSales);
router.get('/salesReport/downloadPDF', adminAuth, salesController.downloadSalesPDF);
router.get('/salesReport/downloadExcel', salesController.downloadSalesExcel);

//Admin Dashboard
router.get("/dashboard", adminAuth, dashboardController.loadDashboard);
router.get('/dashboard/chartData', dashboardController.chartData);

module.exports = router;
