import express from 'express';
const router = express.Router();

import  userController from "../controllers/user/userController.js";
import  productController from "../controllers/user/productController.js";
import  profileController from "../controllers/user/profileController.js";
import  cartController from "../controllers/user/cartController.js";
import  orderController from "../controllers/user/orderController.js";
import  couponController from "../controllers/admin/couponController.js";
import  wishlistController from "../controllers/user/wishlistController.js";
import  walletController from "../controllers/user/walletController.js";

import { checkProductAvailability } from "../middlewares/productAuth.js";
import { checkUserStatus as userStatus } from "../middlewares/userStatus.js";
import upload from "../middlewares/upload.js";

import passport from "passport";


//User Auths and Registration
router.get('/', userController.loadHomePage)
router.get('/signup', userController.loadSignup)
router.post('/signup', userController.signup)
router.post('/verifyOtp', userController.verifyOtp)
router.post('/resendOtp', userController.resendOtp)
router.get('/login', userController.loadLogin)
router.post('/login', userController.login)
router.post('/logout', userController.logout)
router.get('/verifyEmail', userController.loadVerifyEmail)
router.post('/verifyEmail', userController.verifyEmail)
router.post('/resetPasswordOtp', userController.resetPasswordOtp)
router.get('/newPassword', userController.loadNewPassword)
router.post('/newPassword', userController.newPassword)

//shopping page
router.get('/shop', userStatus, userController.loadShoppingPage);
router.get('/shop/:category', userController.loadShoppingPage)

//Product Management
router.get('/productDetails', checkProductAvailability, userStatus, productController.productDetails);
router.get('/reviews/:productId', productController.loadReviews);
router.post('/reviews/add', productController.addReviews);

// Search products
router.get("/search", checkProductAvailability, userStatus,productController.loadSearchResults);

//User Profile Management
router.get('/profile', userStatus,profileController.profile)
router.get('/profile/changePassword', userStatus,profileController.loadChangePassword)
router.post('/profile/changePassword', userStatus,profileController.changePassword)
router.get('/profile/edit', userStatus,profileController.editProfile)
router.post('/profile/edit', userStatus,profileController.updateProfile)
router.post('/profile/upload', upload.single('profileImage'), userStatus, profileController.updateProfileImage);
router.post('/profile/verifyOtp', userStatus,profileController.verifyOtp)
router.post('/profile/resendOtp', userStatus,profileController.resendOtp)
router.get('/profile/forgotOldPassword', userStatus, profileController.loadForgotOldPassword)
router.post('/profile/forgotOldPassword', userStatus,profileController.forgotOldPassword)
router.post('/profile/setNewPassword', userStatus,profileController.setNewPassword)

//User address Management
router.get('/profile/address', userStatus, profileController.address);
router.post('/profile/address/add', userStatus, profileController.addAddress);
router.post('/profile/address/delete', userStatus, profileController.deleteAddress);
router.post('/profile/address/edit/:id', userStatus, profileController.editAddress);

//Cart Management
router.get('/cart', cartController.loadCart);
router.post('/cart', userStatus, checkProductAvailability, cartController.addTocart);
router.post('/cart/remove' , userStatus, cartController.removeFromCart)
router.post('/cart/update', userStatus, cartController.updateQuantity);

//Order Management
router.get('/orders', userStatus,orderController.loadCheckoutPage);
router.post('/orders', userStatus, orderController.checkout);
router.post('/verifyPayment', orderController.verifyPayment);
router.get('/loadRetryPayment', orderController.loadRetryPayment)
router.post('/retryPayment', orderController.retryPayment);
router.get('/myOrders', userStatus, orderController.orderHistory);
router.get('/myOrders/:id', userStatus, orderController.orderDetails);
router.post('/myOrders/:id/cancel', userStatus, orderController.cancelOrder);
router.post('/myOrders/:orderId/item/:itemId/cancel', userStatus, orderController.cancelSingleItem)
router.post('/myOrders/:id/return', userStatus, orderController.returnOrder);
router.post('/myOrders/:orderId/item/:itemId/return', userStatus,orderController.returnSingleItem)
router.get('/myOrders/:id/invoice', userStatus, orderController.downloadInvoice);
router.get('/orderSuccess', orderController.orderSuccess);

//User Coupon Management
router.post('/applyCoupon', userStatus, couponController.applyCoupon);
router.post('/removeCoupon', userStatus, couponController.removeCoupon);

//Wallet Management
router.get('/loadWallet', userStatus, walletController.loadWallet);
router.post('/wallet/addMoney', userStatus, walletController.addMoney);
router.post('/wallet/verifyPayment', userStatus, walletController.verifyPayment);
router.get('/referral', userStatus, walletController.loadreferral);

//Wishlist Management
router.get('/wishlist', userStatus, wishlistController.loadWishlist);
router.post('/wishlist', userStatus, wishlistController.addToWishlist);
router.post('/wishlist/removeItem', userStatus, wishlistController.removeFromWishlist);

//About Page
router.get('/about', productController.loadAboutPage);

//Contact Page
router.get('/contact', productController.loadContactPage);


router.get('/auth/google', passport.authenticate('google', {scope:['profile','email']}));

router.get('/google/callback', passport.authenticate('google',{failureRedirect:'/login'}), userStatus,(req,res)=>{
    res.redirect('/')
});

export default router;