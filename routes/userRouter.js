const express = require ('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const { route } = require('../app')
const passport = require('passport')

router.get('/pageNotFound',userController.pageNotFound)
router.get('/',userController.loadHomePage)
router.get('/signup', userController.loadSignup)
router.post('/signup', userController.signup)
router.post('/verify-otp', userController.verifyOtp)
router.post('/resendOtp', userController.resendOtp)
router.get('/login', userController.loadLogin)
router.post('/login', userController.login)

router.get('/auth/google', passport.authenticate('google',{scope:['profile','email']}));

router.get('/google/callback', passport.authenticate('google', {failureRedirect:'/login'}), (req,res)=>{
    res.redirect('/')
});

module.exports = router;