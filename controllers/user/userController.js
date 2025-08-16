const User = require("../../models/userSchema")
const flash = require("connect-flash")
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const dotenv = require('dotenv')
dotenv.config()
const session = require("express-session")
const { router } = require("../../app")

const loadHomePage = async (req,res) => {
    try {

        return res.render('homePage')
    }catch (error) {

        console.log("Home Page Not Found")
        res.status(500).send("Server error")
        
    }
}

const pageNotFound = async (req,res)=>  {
    try{
        res.render("404-page")
    }catch (error) {
        res.redirect('/pageNotFound')
    }
}

function generateOtp(){
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async  function sendVerificationEmail (email,otp) {
    try {
        const transporter =  nodemailer.createTransport({
            service: 'gmail',
            port:587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP for verifying your Email entered in KITAB4U is: <br> ${otp} </b>`,
        })

        return info.accepted.length > 0
        
    } catch (error) {
        console.error("Error sending OTP:",error)
        return false;
    }
}

async  function resendOtpVerification (email,otp) {
    try {
        const transporter =  nodemailer.createTransport({
            service: 'gmail',
            port:587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Resent OTP for verifying your account",
            text: `Your Re-sent OTP is ${otp}`,
            html: `<b>Resent OTP for verifying your Email entered in KITAB4U is: <br> ${otp} </b>`,
        })

        return info.accepted.length > 0
        
    } catch (error) {
        console.error("Error resending OTP:",error)
        return false;
    }
}

const loadSignup = async ( req,res) => {
    try{
        return res.render ('signup', {
        error: req.flash("error"),
        success: req.flash("success"),
        formData: req.flash("formData")[0] || {}
    })
    }catch (error) {
        console.log("Home page not loading: ",error);
        res.status(500).send('Server Error')
    }
}

const signup = async (req, res) => {
    let { name, email, phone, password, confirmPassword } = req.body;

        console.log(req.body);

    if (!name || !email || !phone || !password || !confirmPassword) {
        req.flash("error", "Please fill all the details");
        req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

    // Name: only letters, single spaces between words, no leading/trailing space
    const nameRegex = /^(?!.*\s{2,})(?!\s)([A-Za-z]+(?:\s[A-Za-z]+)*)$/;
    if (!nameRegex.test(name) || name.replace(/\s/g, '').length < 5) {
        req.flash("error", "Name should be at least 5 letters and contain only alphabets with spaces only between words");
       req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

    const checkEmail = /^[\w.-]+@[\w.-]+\.(com|in|org|net)$/;
    if (!checkEmail.test(email)) {
        req.flash("error", "Invalid Email");
        req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

       const checkPassword = /^(?=.{7,}$)(?=.*[A-Za-z]|\d)[A-Za-z\d@._!#$%&*?-]+$/

    if (!checkPassword.test(password)) {
        req.flash("error", "Password must be 7 characters");
        req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

    if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match");
        req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

    const checkPhone = /^[0-9]{10}$/;
    if (!checkPhone.test(phone)) {
        req.flash("error", "Phone number must be 10 digit numbers");
        req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

    try {
        const existingUser = await User.findOne({ email });

        if (existingUser && !existingUser.isBlocked) {
            req.flash("error", "User email already exists");
            return res.redirect("/signup");
        }

        const existingPhone = await User.findOne({ phone: User.phone });
        if (existingPhone) {
          req.flash('error', "Phone number already exist");
          return res.redirect('/signup')
        }

        const otp = generateOtp();

        const emailSent = await sendVerificationEmail(email,otp);
        if(!emailSent) {
            return res.json("email-error")
        }

        req.session.userOtp = otp;
        req.session.userData = {name, phone, email, password};

        res.render("verify-otp",  {
        error: req.flash("error"),
        success: req.flash("success")
    });
        console.log("OTP Sent:",otp)

    } catch (error) {
        console.error("signup error:", error);
        res.redirect("/pageNotFound")
    }
};

 const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

     if (!req.session.userOtp || !req.session.userData) {
      return res.json({ success: false, message: 'Session expired. Please try signing up again.', redirect: '/signup' });
    }
    
     if (Date.now() > req.session.otpExpiry) {
      return res.json({ success: false, message: 'OTP expired! Please request a new one.' });
    }

    if (otp === req.session.userOtp) {
      const user = req.session.userData;

          const existingUser = await User.findOne({ email: user.email });
      if (existingUser) {
          req.session.user = existingUser._id;
        delete req.session.userOtp;
        delete req.session.userData;
        delete req.session.otpExpiry;
        delete req.session.otpAttempts;
        return res.json({ success: false, message: 'This email is already registered. Please log in.' });
      }

      if (user.phone) {
        const existingPhone = await User.findOne({ phone: user.phone });
        if (existingPhone) {
          return res.json({ success: false, message: 'Phone number already registered.' });
        }
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);
      const newUser = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: hashedPassword
      });

      await newUser.save();

      req.session.user = newUser._id;

    delete req.session.userOtp;
      delete req.session.userData;
      delete req.session.otpExpiry;
      delete req.session.otpAttempts;

      return res.json({ success: true, message: 'Account created successfully. Redirecting...' });
    } else {
      return res.json({ success: false, message: 'Invalid OTP! Please try again!' });
    }
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify OTP. Please try again.' });
  }
};

const resendOtp = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.json({ success: false, message: 'Session expired. Please try signing up again.', redirect: '/signup' });
    }

        // Limit OTP resend attempts
    if (!req.session.otpAttempts) req.session.otpAttempts = 0;
    if (req.session.otpAttempts >= 3) {
      return res.json({ success: false, message: 'Too many OTP requests. Please try again later.' });
    }
    req.session.otpAttempts++;

    const newOtp = generateOtp();
    req.session.userOtp = newOtp;
     req.session.otpExpiry = Date.now() + 2 * 60 * 1000;

    const emailSent = await resendOtpVerification(req.session.userData.email, newOtp);
    if (!emailSent) {
      return res.json({ success: false, message: 'Failed to resend OTP. Please try again.' });
    }

    console.log(`New OTP is ${newOtp}`);

    return res.json({ success: true, message: 'New OTP sent successfully.' });
    
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again.' });
  }
};

const loadLogin = async (req,res) => {
    try {

        if(!req.session.user) {
            return res.render('login')
        }else {
            res.redirect('/')
        }
        
    } catch (error) {

        console.log("Login Page Not Found")
        res.status(500).send("Server error")

        res.redirect('/pageNotFound')

    }
}

const login = async (req,res) => {
    try {
        
        const {email, password} = req.body;

        const findUser = await User.findOne({isAdmin:0, email: email})

        if(!findUser) {
            return res.render('login', {message: "User not found"})
        }
        if(findUser.isBlocked){
            return res.render('login', {message: "User is blocked by admin"})
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password)

        if(!passwordMatch) {
            return res.render("login", {message: "Incorrect Password"})
        }

        req.session.user = findUser.id;
        res.redirect('/')
    } catch (error) {
        
        console.error('login error:', error)
        res.render('login', {message: "Login Failed! Please try again!" })

    }
}

module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login
}

