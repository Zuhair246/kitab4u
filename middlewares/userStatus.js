const User = require("../models/userSchema");

const checkUserStatus = async (req, res, next) => {
  try {

    const user = await User.findById(req.session.user._id);

    if (user.isBlocked) {
      req.session.user = null;
      console.log("User Force Logged Out");
      
      res.redirect('/login')
    } else {
      next();
    }
  } catch (error) {
    console.error("User status check failed:", error);
    return res.redirect("/login");
  }
};

module.exports = checkUserStatus;
