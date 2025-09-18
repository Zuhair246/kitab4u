const User = require("../models/userSchema");

const checkUserStatus = async (req, res, next) => {
  try {

    if(!req.session.user) {
      return next();
    }

    const user = await User.findById(req.session.user._id);

    if(!user) {
      req.session.user = null;
      return res.redirect('/login');
    }

    if (user.isBlocked) {
      req.session.user = null;
      console.log("Blocked User Forcefully Logged Out");
      
     return res.redirect("/login?error=" + encodeURIComponent("Your account has been blocked"));
    } else {
      next();
    }
  } catch (error) {
    console.error("User status check failed:", error);
    return res.redirect("/login");
  }
};

module.exports = checkUserStatus;
