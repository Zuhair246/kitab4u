import express from "express";
const router = express.Router();

import * as adminController from "../controllers/admin/adminController.js";  //eg: if each fns are seperately exported.
import customerController from "../controllers/admin/customerController.js"; //eg: if all fns together exported as a object.
import categoryController from "../controllers/admin/categoryController.js";
import productController from "../controllers/admin/productController.js";
import orderController from "../controllers/admin/orderController.js";
import couponController from "../controllers/admin/couponController.js";
import productOfferController from "../controllers/admin/productOfferController.js";
import salesController from "../controllers/admin/salesController.js";
import dashboardController from "../controllers/admin/dashboardController.js";

import { adminAuth } from "../middlewares/adminAuth.js";
import { uploadImages } from "../middlewares/imgValid.js";
import { valdateCoupon as couponValidator } from "../middlewares/couponValidator.js";

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

export default router;
