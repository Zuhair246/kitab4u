import User from '../models/userSchema.js';

export const checkUserStatus = async (req, res, next) => {
  try {

    if(!req.session.user && !req.user) {
      return next();
    }
    const userId = req.session.user?._id || req.user?._id || req.session.user || req.user;
    if(!userId) {
      if(req.session.user){
        req.session.user = null;
      }
      if(req.user) {
        delete req.user;
      }
      return res.status(401).redirect('/login');
    }

    const user = await User.findById(userId);

    if(!user) {
      if(req.session.user) {
        req.session.user = null;
      }
      if(req.user){
        delete req.user;
      }
      return res.status(401).redirect('/login')
    }

    if (user.isBlocked) {
      if(req.session.user){
        req.session.user = null;
      }
      if(req.user){
        delete req.user;
      }
    console.log("Blocked User Forcefully Logged Out");
    return res.status(403).redirect("/login?error=" + encodeURIComponent("Your account has been blocked"));
    }
      
    return next();
    
  } catch (error) {
    console.error("User status check failed:", error);
    return res.status(500).redirect("/login");
  }
};
