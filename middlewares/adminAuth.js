const User = require('../models/userSchema');

const adminAuth = async (req, res, next) => {
    try {
        if(!req.session.admin) {
            return res.redirect("/admin");
        }
        const admin = await User.findById(req.session.admin);

        if(!admin || !admin.isAdmin) {
            req.session.admin = null;
            return res.redirect("/admin")
        }
        next();
        
    } catch (error) {
        console.error("Admin auth error: ", error);
        return res.status(500).send("Internal Sever Error");
    }
}

module.exports = {
    adminAuth
}
