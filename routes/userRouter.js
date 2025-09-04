const express = require ('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const productController = require('../controllers/user/productController')
const {userAuth }= require('../middlewares/auth')
const { route } = require('../app')
const passport = require('passport')

router.get('/pageNotFound',userController.pageNotFound)
router.get('/',userController.loadHomePage)
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
router.get('/shop', userController.loadShoppingPage);

//Product Management
router.get('/productDetails', productController.productDetails)

// Search products
router.get("/search", productController.loadSearchResults);


router.get('/auth/google', passport.authenticate('google',{scope:['profile','email']}));

router.get('/google/callback', passport.authenticate('google', {failureRedirect:'/login'}), (req,res)=>{
    res.redirect('/')
});

module.exports = router;