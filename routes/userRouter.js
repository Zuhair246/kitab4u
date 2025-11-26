const express = require ('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const productController = require('../controllers/user/productController');
const profileController = require('../controllers/user/profileController');
const cartController = require('../controllers/user/cartController');
const orderController = require('../controllers/user/orderCotroller');
const couponController = require('../controllers/admin/couponController');
const wishlistController = require('../controllers/user/wishlistController');
const walletController = require('../controllers/user/walletController');
const {userAuth }= require('../middlewares/auth');
const checkProductAvailability = require('../middlewares/productAuth');
const userStatus = require('../middlewares/userStatus');
const upload = require('../middlewares/upload');
const { route } = require('../app');
const passport = require('passport');

router.get('/pageNotFound',userController.pageNotFound)

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
router.get('/productDetails', checkProductAvailability, userStatus, productController.productDetails)

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
router.get('/orders', userStatus,orderController.loadOrderPage);
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

//Order Coupon Management
router.post('/applyCoupon', couponController.applyCoupon);
router.post('/removeCoupon', couponController.removeCoupon);

//Wallet Management
router.get('/loadWallet', walletController.loadWallet);
router.post('/wallet/addMoney', walletController.addMoney);
router.post('/wallet/verifyPayment', walletController.verifyPayment);

//Wishlist Management
router.get('/wishlist', wishlistController.loadWishlist);
router.post('/wishlist', wishlistController.addToWishlist);
router.post('/wishlist/removeItem', wishlistController.removeFromWishlist);


router.get('/auth/google', passport.authenticate('google', {scope:['profile','email']}));

router.get('/google/callback', passport.authenticate('google',{failureRedirect:'/login'}), userStatus,(req,res)=>{
    res.redirect('/')
});

module.exports = router;