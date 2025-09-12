const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer')
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const { generateOtp, sendVerificationEmail, resendOtpVerification } = require("../../helpers/otpService");

const profile = async (req,res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId)
    res.render('profile', {
      user: userData,
      success: req.flash("success")
    })
  } catch (error) {
    console.error('User Profile load error:' ,error)
    res.redirect('/pageNotFound')
  }
}

const editProfile = async (req,res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId)
    res.render('editProfile', {
        user: userData,
          error: req.flash("error"),
        success: req.flash("success"),
        formData: req.flash("formData")[0] || {}
    })
  } catch (error) {
    console.error("Edit profile error:", error);
    res.redirect('/pageNotFound')
    
  }
}

const updateProfile = async (req,res) => {
  try {
        const userId = req.session.user;
    const {name, email, phone} = req.body;

    const user = await User.findById(userId)

    let updated = false;

    if(name && name !== user.name) {
      user.name = name;
      updated = true;
    }
    
    if(phone && phone.trim() !== String(user.phone)) {

   const checkPhone = /^(?!([0-9])\1{9})([6-9][0-9]{9})$/;
if (!checkPhone.test(phone)) {
    req.flash("error", "Invalid Phone number format");
    return res.redirect("/profile/edit");
}

  const existingPhone = await User.findOne({phone})
      if(existingPhone) {
        req.flash('error', "Phone number already exist");
        return res.redirect('/profile/edit');
      }
      user.phone = phone;
      updated = true;
    }
    
    if(email && email !== user.email) {
   const checkEmail = /^[\w.-]+@[\w.-]+\.(com|in|org|net)$/;
    if (!checkEmail.test(email)) {
        req.flash("error", "Invalid Email");
        return res.redirect("/profile/edit");
    }

  const existingEmail = await User.findOne({email});
  if(existingEmail) {
    req.flash('error', "Email already exist")
    return res.redirect('/profile/edit')
  }
req.session.pendingEmail = email;
const otp = generateOtp();
await sendVerificationEmail(email, otp);
req.session.userOtp = otp;

console.log(`OTP for updating email: ${otp}`);

req.flash('info', "OTP sent to new email, Please verify...");
 res.render("verify-otp",  {
        error: req.flash("error"),
        success: req.flash("success"),
        formAction: "/profile/verifyOtp"
    });
  }

  if (updated) {
  await user.save();
  req.flash("success", "Profile updated successfully")
  return res.redirect('/profile');
}
  } catch (error) {
    console.error("Profile update error:", error)
    return res.redirect('/profile/edit')
  }
}

const verifyOtp = async (req,res) => {
  try {
    const {otp} = req.body;
    const userId = req.session.user;
    const user = await User.findById(userId)
    if(otp === req.session.userOtp) {
      user.email = req.session.pendingEmail;
      await user.save();
      req.session.otpAttempts = 0;
      delete req.session.userOtp;
      delete req.session.pendingEmail;
      return res.json({
    success: true,
    message: "Email updated successfully!",
    redirect: "/profile/edit"
  });
} else {
  return res.json({
    success: false,
    message: "Invalid OTP",
    redirect: "/profile/verifyOtp"
  });
}
  } catch (error) {
    console.error("Update email otp error:", error)
    res.redirect('/profile/verifyOtp')
  }
}

const resendOtp = async (req, res) => {
  try {

    if (!req.session.user) {
      return res.json({
        success: false,
        message: "Session expired, Please try again",
        redirect: "/login",
      });
    }

    const userId = req.session.user;
    const user = await User.findById(userId);
    const email = user.email;

    if (!req.session.otpAttempts) req.session.otpAttempts = 0;
    if (req.session.otpAttempts >= 3) {
          req.session.user = null;
          req.session.userOtp = null;
          req.session.otpExpiry = null;
      
      return res.json({
        success: false,
        message: "Too many OTP requests. Please try again later.",
        redirect: "/profile/edit",
      });
    }
    req.session.otpAttempts++;

    const newOtp = generateOtp();
    req.session.userOtp = newOtp;
    req.session.otpExpiry = Date.now() + 2 * 60 * 1000;

    await resendOtpVerification(email, newOtp);

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
      redirect: "/verifyOtp",
    });
  }
};

const loadChangePassword = async (req,res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId)
    res.render('changePassword', {
      user,
       error: req.flash("error"),
        success: req.flash("success"),
        formData: req.flash("formData")[0] || {}
    })
  } catch (error) {
    console.log("change load password error:" ,error);
    
  }
}

const changePassword = async (req,res) => {
  try {
    const {oldPassword, newPassword, confirmPassword} = req.body;
    const userId = req.session.user;
    const user = await User.findById(userId)
    const passwordMatch = await bcrypt.compare(oldPassword, user.password)

    if(!oldPassword) {
      req.flash('error', "Enter old password");
      return res.redirect('/profile/changePassword')
    }

    if(passwordMatch) {
        if(newPassword===confirmPassword) {
          if(!oldPassword || !newPassword) {
                req.flash('error',"Enter old password and new password")
                req.flash("formData", {newPassword, confirmPassword})
                return res.redirect('/profile/changePassword')
              }
              const checkPassword = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{7,}$/
              if (!checkPassword.test(newPassword)) {
                  req.flash("error", "Password must be 7 characters with atleast one alphabet, one number and non-alphanumeric character");
                  req.flash("formData", { newPassword, confirmPassword });
                  return res.redirect("/profile/changePassword");
              }
          
              if(newPassword !== confirmPassword) {
                req.flash('error', "Password miss-match")
                req.flash("formData", {newPassword, confirmPassword})
                return res.redirect('/profile/changePassword')
              }

              if(newPassword === oldPassword) {
              req.flash('error', "New password should not be same as old password")
              return res.redirect('/profile/changePassword')
                }

                const hashedPassword = await bcrypt.hash(newPassword, 10);
                user.password = hashedPassword;
                await user.save();
                console.log("Password updated");
                req.session.user = null;
                res.render('/login', {'message': "Password reset successful, Please login again"})
        }
    }else {
              req.flash('error', "You have entered wrong password")
              return res.redirect('/profile/changePassword')
    }

  } catch (error) {
    console.log("Change password error:", error);
    
  }
}

const loadForgotOldPassword = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    res.render('forgotOldPassword', {
            user,
            error: req.flash("error"),
            success: req.flash("success"),
            formData: req.flash("formData")[0] || {}
    })
  } catch (error) {
    console.log("Load Forgot Password Page error: ", error);
    
  }
}

const forgotOldPassword = async (req,res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const email = user.email;
    const otp = generateOtp();
    await sendVerificationEmail(email,otp, "Password Reset Verification");

    console.log(`OTP for for old password: ${otp}`);

    req.session.userOtp = otp;
      req.flash('success', "OTP sent to your email!");
                res.render("forgotOldPassword",  {
                  user,
            error: req.flash("error"),
            success: req.flash("success"),
            formData: req.flash("formData")[0] || {}
        });

  } catch (error) {
    console.error("forgot old password error:", error);
    res.redirect('/pageNotFound');
  }
}

const setNewPassword = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    const {otp, newPassword, confirmPassword} = req.body;

    if(otp===req.session.userOtp) {

          const checkPassword = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{7,}$/
      
          if (!checkPassword.test(newPassword)) {
              req.flash("error", "Password must be 7 characters with atleast one alphabet, one number and non-alphanumeric character");
              req.flash("formData", {newPassword, confirmPassword});
              return res.redirect("/profile/forgotOldPassword");
          }
      
          if (newPassword !== confirmPassword) {
              req.flash("error", "Passwords do not match");
              req.flash("formData", { newPassword, confirmPassword});
              return res.redirect("/profile/forgotOldPassword");
          }

      if(newPassword===confirmPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.password = hashedPassword;
        await user.save();
        req.session.user = null;
        res.render('login', {'message':"Password updated login again"})
      }
    }else {
      req.flash('error', "Invalid OTP")
      return res.redirect('/profile/forgotOldPassword');
    }

    } catch (error) {
    console.error("Set new password error:", error);
    res.redirect("/profile/forgotOldPassword")
  }
}

const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      req.flash("error", "Please upload an image");
      return res.redirect("/profile/edit");
    }

    const userId = req.session.user;
    const user = await User.findById(userId);

    const uploadDir = path.resolve(__dirname, "../../public/uploads/profile");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save resized image
    const filename = `user-${Date.now()}.png`;
    const outputPath = path.join(uploadDir, filename);

    await sharp(req.file.buffer)
      .resize(300, 300)
      .png({ quality: 90 })
      .toFile(outputPath);

    // Remove old image if exists
    if (user.image) {
      const oldPath = path.join(uploadDir, user.image);
      if(fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save new image
    user.image = filename;
    await user.save();

    req.flash("success", "Profile picture updated");
    res.redirect("/profile");
  } catch (error) {
    console.error("Profile image update error:", error);
    res.redirect("/pageNotFound");
  }
};

 const address = async (req,res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId)
    const address = await Address.findOne({userId: userId})

    res.render('address', {
      user,
      userAddress: address,
      error: req.flash("error"),
      success: req.flash("success"),
    })

  } catch (error) {
    console.log("User Address load error:",error);
    return res.redirect('/pageNotFound')
  }
 }

 const loadAddAddress = async (req,res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

     res.render('addAddress', {
      user,
      error: req.flash("error"),
      success: req.flash("success"),
    })
  } catch (error) {
    console.log("Add address page load error:", error);
    return res.redirect('/pageNotFound')
    
  }
 }

 const addAddress = async (req,res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const {name, city, landMark, state, pinCode, phone, altPhone, addressType, } = req.body;
    console.log(userData);
    
    const userAddress = await Address.findOne({userId: userData._id});
    if(!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [{addressType, name, city, landMark, state, pinCode, phone, altPhone}]
      })
      await newAddress.save()
    }else {
      userAddress.address.push({addressType, name, city, landMark, state, pinCode, phone, altPhone});
      await userAddress.save();
    }
    res.redirect('/profile/address')
  } catch (error) {
    console.log("Adding address error:",error);
    res.redirect('/pageNotFound')
  }
 }

module.exports = {
    profile,
    loadChangePassword,
    changePassword,
    editProfile,
    updateProfile,
    verifyOtp,
    resendOtp,
    updateProfileImage,
    loadForgotOldPassword,
    forgotOldPassword,
    setNewPassword,
    address,
    loadAddAddress,
    addAddress
}