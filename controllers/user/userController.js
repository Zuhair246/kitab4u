const User = require("../../models/userSchema")
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Wishlist = require('../../models/wishlistSchema')
const mongoose = require('mongoose')
const flash = require("connect-flash")
const bcrypt = require("bcrypt")
const nodemailer = require("nodemailer")
const dotenv = require('dotenv')
dotenv.config()
const session = require("express-session")
const { generateOtp, sendVerificationEmail, resendOtpVerification } = require("../../helpers/otpService");

// const { router } = require("../../app")

const loadHomePage = async (req,res) => {
    try {
        const user = req.session.user || req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1)*limit;
        const Categories = await Category.find({isListed: true});
        let productData = await Product.find({
          isBlocked: false,
          categoryId:{$in: Categories.map(category => category._id)},
          'variants.stock' : {$gt:0}
        })
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit);

        productData = productData.map(product => {
        const paperback = product.variants.find(v => v.format === "Paperback");
       const defaultPrice = paperback ? paperback.discountPrice : product.variants[0]?.discountPrice;

  return {
    ...product._doc,
    defaultPrice
  };
});

 const totalProducts = await Product.countDocuments({
      isBlocked: false,
      categoryId: { $in: Categories.map(category => category._id) },
      'variants.stock': { $gt: 0 },
    });


        const totalPages = Math.ceil(totalProducts /  limit);
      
        const searchQuery = req.query.q ? req.query.q.trim() : "";

    if (user && user._id) {
      const userData = await User.findById(user._id); 
    
        if (searchQuery) {
      filter.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { author: { $regex: searchQuery, $options: "i" } }
      ];
    }
      
      // if (!userData) {
      //   return res.render("homePage", {books: productData}); 
      // }
      return res.render("homePage", { 
                                                        user: userData, 
                                                        books: productData,
                                                        currentPage: page,
                                                        totalPages,
                                                        searchQuery
                                                      });
    }

    res.render("homePage", {
                                            books: productData,
                                            currentPage: page,
                                            totalPages,
                                            searchQuery
                                            });
    }catch (error) {

        console.log("Home Page Not Loading:", error)
        res.status(500).send("Server error")
        res.send('/pageNotFound')
    }
}

const pageNotFound = async (req,res)=>  {
    try{
        res.render("404-page")
    }catch (error) {
        res.redirect('/pageNotFound')
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

    const allowedDomains = 'com|in|org|net|co|gov|edu|co\\.in|ac\\.in|gov\\.in|io|ai|dev|app|shop|biz|info|me|tv|cloud';
    const checkEmail = new RegExp(`^[\\w.-]+@[\\w.-]+\\.(${allowedDomains})$`);
    if (!checkEmail.test(email)) {
        req.flash("error", "Invalid Email");
        req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

    const checkPassword = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{7,}$/

    if (!checkPassword.test(password)) {
        req.flash("error", "Password must be 7 characters with atleast one alphabet, one number and non-alphanumeric character");
        req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

    if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match");
        req.flash("formData", { name, email, password, phone });
        return res.redirect("/signup");
    }

const checkPhone = /^(?!([0-9])\1{9})([6-9][0-9]{9})$/;

if (!checkPhone.test(phone)) {
    req.flash("error", "Invalid Phone number format");
    req.flash("formData", { name, email, password, phone });
    return res.redirect("/signup");
}


    try {
        const existingUser = await User.findOne({ email });

        if (existingUser && !existingUser.isBlocked) {
            req.flash("error", "User email already exists");
            req.flash("formData", { name, email, password, phone });
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
        req.session.otpExpiry = Date.now() + 2 * 60 * 1000;

        res.render("verify-otp",  {
        error: req.flash("error"),
        success: req.flash("success"),
        formAction: "/verifyOtp"
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
      return res.json({ 
        success: false, 
        message: 'Session expired. Please try signing up again.', 
        redirect: '/signup' 
      });
    }

    if (Date.now() > req.session.otpExpiry) {
      return res.json({ 
        success: false, 
        message: 'OTP expired! Please request a new one.' 
      });
    }

    if (otp === req.session.userOtp) {
      const user = req.session.userData;

      const hashedPassword = await bcrypt.hash(user.password, 10);
      const newUser = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: hashedPassword,
        isVerified: true
      });

      await newUser.save();
      req.session.user = newUser;
      console.log(req.session.user.name);
      

      return res.json({ 
        success: true, 
        message: 'Account created successfully! Redirecting to home...', 
        redirect: '/' 
      });
    } else {
      return res.json({ success: false, message: 'Invalid OTP! Please try again!' });
    }
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to verify OTP. Please try again.' 
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    if (!req.session.userData) {
      return res.json({
        success: false,
        message: "Session expired, Please try again",
        redirect: "/login",
      });
    }

    if (!req.session.otpAttempts) req.session.otpAttempts = 0;
    if (req.session.otpAttempts >= 3) {
          req.session.userData = null;
          req.session.userOtp = null;
          req.session.otpExpiry = null;
      
      return res.json({
        success: false,
        message: "Too many OTP requests. Please try again later.",
        redirect: "/verify-otp",
      });
    }
    req.session.otpAttempts++;

    const newOtp = generateOtp();
    req.session.userOtp = newOtp;
    req.session.otpExpiry = Date.now() + 2 * 60 * 1000;

    await resendOtpVerification(req.session.userData.email, newOtp);

    console.log(`New OTP is ${newOtp}`);

    return res.json({
      success: true,
      message: "New OTP sent successfully.",
    });

  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.json({
      success: false,
      message: "Failed to resend OTP. Please try again.",
      redirect: "/verify-otp",
    });
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

        if(!email || !password) {
          return res.render('login', {message: "Enter email and password"})
        }

        const findUser = await User.findOne({isAdmin:0, email: email})

        if(!findUser) {
            return res.render('login', {message: "User not found"})
        }
        if(findUser.isBlocked){
            return res.render('login', {message: "User is blocked by admin"})
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password)

        if(!passwordMatch) {
            return res.render("login", {message: "Incorrect Email or Password"})
        }

        req.session.user = {
           _id: findUser._id,
           name: findUser.name,
           email: findUser.email
        }
        console.log(`Login session data: ${req.session.user}`);
        
        res.redirect('/')
    } catch (error) {
        
        console.error('login error:', error)
        res.render('login', {message: "Login Failed! Please try again!" })

    }
}

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) return res.redirect("/pageNotFound");
      res.clearCookie("user.sid");
      return res.redirect("/login");
    });
  } catch (error) {
    return res.redirect("/pageNotFound");
  }
};


const loadVerifyEmail = async (req,res) => {
    try {
         res.render("verifyEmail",  {
        error: req.flash("error"),
        success: req.flash("success")
    });
    } catch (error) {
     console.log('Verify email loading error:', error);
     res.status(500).send("Server error")
        
    }
}

const verifyEmail = async (req,res) => {
    try {
      const {email} = req.body;
      const user = await User.findOne({email})
        if(!email){
            req.flash('error', "Enter the email")
          return  res.redirect('/verifyEmail')
        }
     const checkEmail = /^[\w.-]+@[\w.-]+\.(com|in|org|net)$/;
    if (!checkEmail.test(email)) {
        req.flash("error", "Invalid Email");
        return res.redirect("/verifyEmail");
    }
    if(user.googleId){
      req.flash("error", "Google user can't reset password")
       return res.redirect("/verifyEmail");
    }else if(user.isBlocked){
      req.flash('error', "Blocked user cannot reset password");
      return res.redirect('/verifyEmail')
    }

    if(user){
        const otp = generateOtp()
        const emailSent = await sendVerificationEmail(email,otp);
        if(!emailSent) {
            req.flash('error', "OTP didn't send. Network issue..!")
            return res.redirect('/verifyEmail')
        }
        req.session.userOtp = otp;
        req.session.otpExpiry = Date.now() + 2 * 60 * 1000;
        req.session.userData = {email};
        console.log(req.session.userData);
        
        console.log("Forgot password OTP:", otp);
        req.flash('success', "OTP sent to your email!");
            res.render("verify-otp",  {
        error: req.flash("error"),
        success: req.flash("success"),
        formAction: "/resetPasswordOtp"
    });
        }else {
            req.flash('error',"User Email doesn't exist")
            return res.redirect('/verifyEmail')
        }
    } catch (error) {
          console.error("email verification error:", error);
      return  res.redirect("/pageNotFound")
    }
}

 const resetPasswordOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.userOtp) {
      return res.json({ 
        success: false, 
        message: 'Session expired. Please enter email again.', 
        redirect: '/verifyEmail' 
      });
    }

    if (Date.now() > req.session.otpExpiry) {
      return res.json({ 
        success: false, 
        message: 'OTP expired! Please request a new one.' 
      });
    }

    if (otp === req.session.userOtp) {
      req.session.resetEmail = req.session.userData.email;
      delete req.session.userOtp;
      return res.json({ 
        success: true, 
        message: 'Email verified successfully ! Redirecting to reset password...', 
        redirect: '/newPassword'
      });
    } else {
      return res.json({ success: false, message: 'Invalid OTP! Please try again!' });
    }
  } catch (error) {
    console.error('Reset password OTP verification error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to verify OTP. Please try again.' 
    });
  }
};

const loadNewPassword = async (req,res) => {
  try {
      res.render("newPassword",  {
        error: req.flash("error"),
        success: req.flash("success")
    });
  } catch (error) {
         console.log('New password loading error:', error);
     res.status(500).send("Server error")
        
  }
}

const newPassword = async (req,res) => {
  try {
    const {newPassword, confirmPassword} = req.body;
    if(!newPassword || !confirmPassword) {
      req.flash('error',"Enter password and confirm password")
      req.flash("formData", {newPassword, confirmPassword})
      return res.redirect('/newPassword')
    }
    const checkPassword = /^(?=.{7,}$)(?=.*[A-Za-z]|\d)[A-Za-z\d@._!#$%&*?-]+$/
    if (!checkPassword.test(newPassword)) {
        req.flash("error", "Password must be 7 characters");
        req.flash("formData", { newPassword, confirmPassword });
        return res.redirect("/newPassword");
    }

    if(newPassword !== confirmPassword) {
      req.flash('error', "Password miss-match")
      req.flash("formData", {newPassword, confirmPassword})
      return res.redirect('/newPassword')
    }
      const email = req.session.resetEmail;
      console.log(email);
      console.log(newPassword);
      
      const user = await User.findOne({email});
      const hashedPassword = await bcrypt.hash(newPassword, 10);
       user.password = hashedPassword;
      await user.save();

    delete req.session.resetEmail; // cleanup

    req.flash("success", "Password reset successful, Please login");
    return res.redirect("/login");
    
  } catch (error) {
            console.error("new password setting error:", error);
        res.redirect("/pageNotFound")
  }
}

const loadShoppingPage = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const userData = userId ? await User.findById(userId) : null;

    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map((c) => c._id);

    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const searchQuery = req.query.q ? req.query.q.trim() : "";
    const selectedCategory = req.params.category || req.query.category || null;
    const selectedPriceRange = req.query.priceRange || null;
    const sortOption = req.query.sort || null;

    const match = {
      isBlocked: false,
      categoryId: { $in: categoryIds },
    };

    if (searchQuery) {
      match.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { author: { $regex: searchQuery, $options: "i" } },
      ];
    }

    if (selectedCategory) {
      const findCategory = await Category.findOne({ name: {$regex: new RegExp(`^${selectedCategory}$`, 'i') } });
      if (findCategory) {
        match.categoryId = findCategory._id;
      }
    }

    const pipelineForCount = [{ $match: match }];

    pipelineForCount.push({
      $addFields: { minPrice: { $min: "$variants.discountPrice" } },
    });

    if (selectedPriceRange) {
      let minP = 0;
      let maxP = Number.POSITIVE_INFINITY;
      switch (selectedPriceRange) {
        case "100-200":
          minP = 100; maxP = 200; break;
        case "200-400":
          minP = 200; maxP = 400; break;
        case "400-700":
          minP = 400; maxP = 700; break;
        case "700-1000":
          minP = 700; maxP = 1000; break;
        case "1000+":
          minP = 1000; maxP = Number.POSITIVE_INFINITY; break;
      }
      const priceMatch = { minPrice: { $gte: minP } };
      if (isFinite(maxP)) priceMatch.minPrice.$lte = maxP;
      pipelineForCount.push({ $match: priceMatch });
    }

    pipelineForCount.push({ $count: "count" });
    const countResult = await Product.aggregate(pipelineForCount);
    const totalProductsCount = (countResult[0] && countResult[0].count) ? countResult[0].count : 0;
    const totalPages = Math.ceil(totalProductsCount / limit);

    const pipeline = [{ $match: match }];

    pipeline.push({ $addFields: { minPrice: { $min: "$variants.discountPrice" } } });

    if (selectedPriceRange) {
      let minP = 0;
      let maxP = Number.POSITIVE_INFINITY;
      switch (selectedPriceRange) {
        case "100-200":
          minP = 100; maxP = 200; break;
        case "200-400":
          minP = 200; maxP = 400; break;
        case "400-700":
          minP = 400; maxP = 700; break;
        case "700-1000":
          minP = 700; maxP = 1000; break;
        case "1000+":
          minP = 1000; maxP = Number.POSITIVE_INFINITY; break;
      }
      const priceMatch = { minPrice: { $gte: minP } };
      if (isFinite(maxP)) priceMatch.minPrice.$lte = maxP;
      pipeline.push({ $match: priceMatch });
    }

    if (sortOption === "low-high") {
      pipeline.push({ $sort: { minPrice: 1, createdAt: -1 } });
    } else if (sortOption === "high-low") {
      pipeline.push({ $sort: { minPrice: -1, createdAt: -1 } });
    } else if (sortOption === "az") {
      pipeline.push({ $sort: { name: 1 } });
    } else if (sortOption === "za") {
      pipeline.push({ $sort: { name: -1 } });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push({ $skip: skip }, { $limit: limit });

    const products = await Product.aggregate(pipeline);

    const wishlist = await Wishlist.findOne({ userId });
    const wishlistItems = wishlist ? wishlist.products.map(p => p.productId.toString()) : [];

    res.render("shop", {
      user: userData,
      books: products,
      category: categories.map((c) => ({ _id: c._id, name: c.name })),
      totalProducts: totalProductsCount,
      currentPage: page,
      totalPages,
      searchQuery,
      selectedCategory,
      selectedPriceRange,
      sortOption,
      wishlistItems,
      error: req.query.error || null
    });
  } catch (error) {
    console.log("Shop page error:", error);
    res.redirect("/pageNotFound");
  }
};


module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadVerifyEmail,
    verifyEmail,
    resetPasswordOtp,
    loadNewPassword,
    newPassword,
    loadShoppingPage,
}

