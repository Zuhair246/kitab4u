const User = require("../models/userSchema");

const checkUserStatus = async (req, res, next) => {
  try {

    if(!req.session.user && !req.user) {
      return next();
    }
    const userId = req.session.user?._id || req.user?._id || req.session.user || req.user;
    if(!userId) {
      if(req.session.user){
        delete req.session.user;
      }
      if(req.user) {
        req.user = null;
      }
      return res.redirect('/login')
    }

    const user = await User.findById(userId);

    if(!user) {
      if(req.session.user) {
        delete req.session.user;
      }
      if(req.user){
        req.user = null;
      }
      return res.redirect('/login')
    }

    if (user.isBlocked) {
      if(req.session.user){
        delete req.session.user;
      }
      if(req.user){
        req.user = null;
      }
    console.log("Blocked User Forcefully Logged Out");
    return res.redirect("/login?error=" + encodeURIComponent("Your account has been blocked"));
    }
      
    next();
    
  } catch (error) {
    console.error("User status check failed:", error);
    return res.redirect("/login");
  }
};

module.exports = checkUserStatus;
