import User from '../models/userSchema.js';

export const adminAuth = async (req, res, next) => {
    try {
        if(!req.session.admin) {
            return res.status(401).redirect("/admin");
        }
        const admin = await User.findById(req.session.admin);

        if(!admin || !admin.isAdmin) {
            req.session.admin = null;
            return res.status(401).redirect("/admin")
        }
        next();
        
    } catch (error) {
        console.error("Admin auth error: ", error);
        return res.status(500).send("Internal Sever Error");
    }
}
