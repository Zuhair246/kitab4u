const User = require("../models/userSchema");

const checkUserStatus = async (req, res, next) => {
  try {

    const user = await User.findById(req.session.user._id);

    if (user.isBlocked) {
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error:", err);
        return res.redirect("/login?error=Your account has been blocked by admin");
      });
    } else {
      next();
    }
  } catch (error) {
    console.error("User status check failed:", error);
    return res.redirect("/login");
  }
};

module.exports = checkUserStatus;
