const express = require ('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const productController = require('../controllers/user/productController')
const profileController = require('../controllers/user/profileController')
const {userAuth }= require('../middlewares/auth')
const checkProductAvailability = require('../middlewares/productAuth')
const userStatus = require('../middlewares/userStatus')
const upload = require('../middlewares/upload')
const { route } = require('../app')
const passport = require('passport')

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

//Product Management
router.get('/productDetails', checkProductAvailability, userStatus, productController.productDetails)

// Search products
router.get("/search", checkProductAvailability, productController.loadSearchResults);

//User Profile Management
router.get('/profile', profileController.profile)
router.get('/profile/changePassword', profileController.loadChangePassword)
router.post('/profile/changePassword', profileController.changePassword)
router.get('/profile/edit', profileController.editProfile)
router.post('/profile/edit', profileController.updateProfile)
router.post('/profile/upload', upload.single('profileImage'), profileController.updateProfileImage);
router.post('/profile/verifyOtp', profileController.verifyOtp)
router.post('/resendOtp', profileController.resendOtp)

router.get('/auth/google', passport.authenticate('google',{scope:['profile','email']}));

router.get('/google/callback', passport.authenticate('google', {failureRedirect:'/login'}), (req,res)=>{
    res.redirect('/')
});

module.exports = router;