const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer')
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const { generateOtp, sendVerificationEmail, resendOtpVerification } = require("../../helpers/otpService");
const { isatty } = require('tty');

const profile = async (req,res) => {
  try {
    const userId = req.session.user || req.user;
    if(!userId) {
      return res.redirect('/login')
    }
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
    const userId = req.session.user || req.user;
    if(!userId){
      return res.redirect('/login')
    }
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
    const userId = req.session.user || req.user;
    const {name, email, phone} = req.body;
    if(!userId){
      return res.redirect('/login')
    }
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
req.session.otpPurpose = "emailUpdate";

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
    if(!userId){
      return res.redirect('/login')
    }
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
    return res.redirect('/profile/verifyOtp')
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

    if (!req.session.otpAttempts) req.session.otpAttempts = 0;
    if (req.session.otpAttempts >= 3) {
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

    let email;

    if (req.session.otpPurpose === "emailUpdate") {
      email = req.session.pendingEmail; // use new email
    } else if (req.session.otpPurpose === "passwordReset") {
      const user = await User.findById(req.session.user);
      email = user.email; // use current email
    } else {
      return res.json({
        success: false,
        message: "Unknown OTP purpose",
        redirect: "/profile/edit",
      });
    }

    await resendOtpVerification(email, newOtp);

    console.log(`Resent OTP (${req.session.otpPurpose}): ${newOtp}`);

    return res.json({
      success: true,
      message: `New OTP sent to ${email}`,
    });

  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.json({
      success: false,
      message: "Failed to resend OTP. Please try again.",
      redirect: "/profile/verifyOtp",
    });
  }
};

const loadChangePassword = async (req,res) => {
  try {
    const userId = req.session.user;
    if(!userId){
      return res.redirect('/login')
    }
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
    if(!userId){
      return res.redirect('/login')
      }
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
     if(!userId){
      return res.redirect('/login')
    }
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
    if(!userId){
      return res.redirect('/login')
    }
    const user = await User.findById(userId);
    const email = user.email;
    const otp = generateOtp();
    await sendVerificationEmail(email,otp, "Password Reset Verification");
    console.log(`OTP for old password: ${otp}`);
    req.session.otpPurpose = "passwordReset";


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
    if(!userId){
      return res.redirect('/login')
    }
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

    const userId = req.session.user || req.user;
    if(!userId){
    return res.redirect('/login')
    }
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

 const address = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if(!userId){
    return res.redirect('/login')
    }
    const user = await User.findById(userId);

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const addressDoc = await Address.findOne({ userId: user._id }).lean();

    let userAddress = addressDoc ? addressDoc.address.filter(addr => !addr.isDeleted) : [];
    userAddress.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    const paginatedAddress = userAddress.slice(skip, skip + limit);

    const totalAddresses = userAddress.length;
    const totalPages = Math.ceil(totalAddresses / limit);

    res.render('address', {
      user,
      addresses: paginatedAddress,
      currentPage: page,
      totalPages,
      error: req.flash("error"),
      success: req.flash("success"),
    });

  } catch (error) {
    console.log("User Address load error:", error);
    return res.redirect('/pageNotFound');
  }
};

//  const loadAddAddress = async (req,res) => {
//   try {
//     const userId = req.session.user || req.user;
//     if(!userId){
//       return res.redirect('/login')
//     }
//     const user = await User.findById(userId);

//      res.render('addAddress', {
//       user,
//       formData: req.flash("formData")[0] || {},
//       error: req.flash("error"),
//       success: req.flash("success"),
//     })
//   } catch (error) {
//     console.log("Add address page load error:", error);
//     return res.redirect('/pageNotFound')
    
//   }
//  }

 const addAddress = async (req,res) => {
  try {
    const userId = req.session.user || req.user;
    if(!userId){
      return res.redirect('/login')
    }
    const userData = await User.findById(userId);
    const {name, city, streetAddress, state, pinCode, phone, altPhone, addressType, isDefault} = req.body;
    
    const isAjax = req.headers['content-type'] === 'application/json';

    if(!name|| !city|| !streetAddress|| !state|| !pinCode ||!phone){
      req.flash('formData', {name, city, streetAddress, state, pinCode, phone, altPhone, addressType});
      const msg = 'Name, City, Street address, State, Pincode, Phone number are required'
      if(isAjax) return res.json({success: false, message: msg});
    } else if(!addressType){
      req.flash('formData', {name, city, streetAddress, state, pinCode, phone, altPhone});
      const msg = 'Choose any address type'
      if(isAjax) return res.json({success: false, message: msg});
    }
    
  const nameRegex = /^(?!.*\s{2,})(?!\s)([A-Za-z]+(?:\s[A-Za-z]+)*)$/;
    if (!nameRegex.test(name) || name.replace(/\s/g, '').length < 5) {
       req.flash("formData", { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
      const msg = ' Name should be at least 5 letters and contain only alphabets with spaces only between words';
      if(isAjax) return res.json({success: false, message: msg})
      }

const checkPhone = /^(?!([0-9])\1{9})([6-9][0-9]{9})$/;
if (!checkPhone.test(phone)) {
    req.flash("formData", { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
    const msg = 'Invalid Phone number format.';
    if(isAjax) return res.json({success: false, message: msg})
    }

if (altPhone && !checkPhone.test(altPhone)) {
    req.flash("formData", { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
    const msg = 'Invalid Alternative Phone number format';
    if(isAjax) return res.json({success: false, message: msg})
}

if (phone===altPhone){
    req.flash('formData', { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
    const msg = 'Phone numbers should not be same';
    if(isAjax) return res.json({success: false, message: msg})
  }

  const stateRegex = /^(?!.*\s{2,})(?!\s)([A-Za-z]+(?:\s[A-Za-z]+)*)$/;
    if (!stateRegex.test(state) || state.replace(/\s/g, '').length < 3) {
       req.flash("formData", { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
        const msg = 'Please enter a proper state in India';
        if(isAjax) return res.json({success: false, message: msg})
    }

  const streetRegex = /^(?=.*[A-Za-z])[A-Za-z\/,\-.'#\s]+$/;
  if(!streetRegex.test(streetAddress)) {
      req.flash("formData", { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
      const msg = 'Invalid characters in street address';
      if(isAjax) return res.json({success: false, message: msg});
  }

if (!stateRegex.test(city) || city.replace(/\s/g, '').length < 3) {
  req.flash("formData", { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
  const msg = 'City name should be at least 5 letters and contain only alphabets with spaces only between words.'
  if(isAjax) return res.json({success: false, message: msg})
}

//Real Pincode validation with API

const pinCodeRegex = /^[1-9][0-9]{5}$/;
  if(!pinCodeRegex.test(pinCode)) {
      req.flash("formData", { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
      const msg = 'Invalid Pincode format (must be 6 digits and not start with 0).';
      if(isAjax) return res.json({success: false, message: msg});
  }

try {
  const response = await fetch(`https://api.postalpincode.in/pincode/${pinCode}`);
  const data = await response.json();
  const result = data[0];

  if (result.Status === 'Error' || !result.PostOffice || result.PostOffice.length === 0) {
    const msg = 'Pincode not found in India Post records.';
    if (isAjax) return res.json({ success: false, message: msg });
  }
} catch (err) {
  console.error('Error verifying pincode:', err);
  const msg = 'Unable to verify pincode at the moment.';
  if (isAjax) return res.json({ success: false, message: msg });
}

const defaultFlag = isDefault === 'on';
 
    const userAddress = await Address.findOne({userId: userData._id});
    if(!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [{addressType, name, city, streetAddress, state, pinCode, phone, isDeleted:false, isDefault:true}]
      })
 await newAddress.save()

    }else {

       if (defaultFlag) {
        await Address.updateOne(
          { userId: userData._id, "address.isDefault": true },
          { $set: { "address.$.isDefault": false } }
        );
      }

      userAddress.address.push({addressType, name, city, streetAddress, state, pinCode, phone, altPhone, isDeleted: false, isDefault: defaultFlag});
        await userAddress.save();
    
    }

    if(isAjax) {
      const newAddress = userAddress
            ? userAddress.address[userAddress.address.length - 1] 
            : newAddress.address[0]
      return res.json({success: true, message: 'Address added successfully !', addressId: newAddress._id})
    }
    res.redirect('/profile/address?success=Address added successfully')
    
  } catch (error) {
    if(req.headers['content- type'] === 'application/json') {
      return res.json({success: false, message: "Server Error"})
    }
    console.log("Adding address error:",error);
    res.redirect('/pageNotFound')
  }
 }

 const deleteAddress = async (req, res) => {
  try {
    const {id} = req.body;
    if (!id) {
    return res.redirect("/profile/address?error=Invalid adress id");
  }
  await Address.updateOne({'address._id':id},{$set:{'address.$.isDeleted':true}})
  return res.redirect("/profile/address?success=Address deleted successfully");
  } catch (error) {
    console.log("Delete address error:", error);
    res.redirect("/pageNotFound")
  }
 }

const editAddress = async (req, res) => {
  try {
    const id = req.params.id; 
    const userId = req.session.user || req.user;
    if(!userId){
        return res.redirect('/login')
    }
    const { name, city, streetAddress, state, pinCode, phone, altPhone, addressType, isDefault } = req.body;

    const isAjax = req.headers['content-type']?.includes('application/json');

    if (!id) {
      const msg = "Invalid address id";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }

    if(!name|| !city|| !streetAddress|| !state|| !pinCode ||!phone){
      const msg = "Name, City, Street, State, Pincode, Phone are required";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }
    if(!addressType){
      const msg = "Choose an address type";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }

    const nameRegex = /^(?!.*\s{2,})(?!\s)([A-Za-z]+(?:\s[A-Za-z]+)*)$/;
    if (!nameRegex.test(name) || name.replace(/\s/g, '').length < 5) {
      const msg = "Name should be at least 5 letters (alphabets only)";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }

    const checkPhone = /^(?!([0-9])\1{9})([6-9][0-9]{9})$/;
    if (!checkPhone.test(phone)) {
      const msg = "Invalid phone number";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }
    if (altPhone && !checkPhone.test(altPhone)) {
      const msg = "Invalid alternative phone number";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }
    if (phone === altPhone) {
      const msg = "Phone numbers should not be same";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }

    const stateRegex = /^(?!.*\s{2,})(?!\s)([A-Za-z]+(?:\s[A-Za-z]+)*)$/;
    if (!stateRegex.test(state) || state.replace(/\s/g, '').length < 3) {
      const msg = "Invalid state name";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }

    if (!stateRegex.test(city) || city.replace(/\s/g, '').length < 3) {
      const msg = "Invalid city name";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }

    const streetRegex = /^(?=.*[A-Za-z])[A-Za-z\/,\-.'#\s]+$/;
    if(!streetRegex.test(streetAddress)) {
      const msg = "Invalid street name";
      return isAjax ? res.json({ success: false, message: msg }) : res.redirect('/profile/address?error=' + encodeURIComponent(msg));
    }

    //Real Pincode validation with API

const pinCodeRegex = /^[1-9][0-9]{5}$/;
  if(!pinCodeRegex.test(pinCode)) {
      req.flash("formData", { name, city, streetAddress, state, pinCode, phone, altPhone, addressType });
      const msg = 'Invalid Pincode format (must be 6 digits and not start with 0).';
      if(isAjax) return res.json({success: false, message: msg});
  }

try {
  const response = await fetch(`https://api.postalpincode.in/pincode/${pinCode}`);
  const data = await response.json();
  const result = data[0];

  if (result.Status === 'Error' || !result.PostOffice || result.PostOffice.length === 0) {
    const msg = 'Pincode not found in India Post records.';
    if (isAjax) return res.json({ success: false, message: msg });
  }
} catch (err) {
  console.error('Error verifying pincode:', err);
  const msg = 'Unable to verify pincode at the moment.';
  if (isAjax) return res.json({ success: false, message: msg });
}

    if (isDefault === "on") {
      await Address.updateOne(
        { "address.isDefault": true, userId },
        { $set: { "address.$.isDefault": false } }
      );
    }

    await Address.updateOne(
      { "address._id": id, userId },
      {
        $set: {
          "address.$.name": name,
          "address.$.city": city,
          "address.$.streetAddress": streetAddress,
          "address.$.state": state,
          "address.$.pinCode": pinCode,
          "address.$.phone": phone,
          "address.$.altPhone": altPhone,
          "address.$.addressType": addressType,
          "address.$.isDefault": isDefault === "on"
        }
      }
    );

    const msg = "Address updated successfully";
    return isAjax ? res.json({ success: true, message: msg }) : res.redirect('/profile/address?success=' + encodeURIComponent(msg));
    
  } catch (error) {
    console.log("Edit address error:", error);
    if (req.headers['content-type'] === 'application/json') {
      return res.json({ success: false, message: "Server Error" });
    }
    res.redirect('/pageNotFound');
  }
};


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
    addAddress,
    deleteAddress,
    editAddress,
    // loadAddAddress,

}