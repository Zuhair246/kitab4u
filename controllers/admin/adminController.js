const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const loadLogin = async (req,res) => {
    try {
        if(req.session.admin) {
           return res.redirect ('/admin/dashboard')
        }
        res.render('adminLogin', {message: null})
    } catch (error) {
        const err = new Error("Admin login page load server error");
        return next(err);
    }
}

const login = async (req,res) => {
    try {
        const {email, password} = req.body;
        if(!email || !password){
            return res.render('adminLogin', {message: "Enter email and password"})
        }
        const admin = await User.findOne({email, isAdmin:true})
        if(admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if(passwordMatch) {
                req.session.admin = admin._id;
                return res.redirect('/admin/dashboard')
            }else {
                return res.render('adminLogin', {message: "Wrong password"})
            }
        }else {
            return res.render('adminLogin', {message: "You are not admin"})
        }
       
    } catch (error) {
        const err = new Error("Admin login server error");
        return next(err);
    }
}

const loadDashboard = async (req, res) => {
    if(req.session.admin) {
        try {
            res.render('dashboard')
        } catch (error) {
            const err = new Error("Admin dashboard load server error");
            return next(err);
        }
    }else{
        return redirect('/admin')
    }
}

 const logout = async (req,res) => {
    try {
        req.session.destroy((err) => {
            if(err) {
                const err = new Error("Failed to logout admin");
                return next(err);
            }
            res.clearCookie("admin.sid");
            return res.redirect('/admin')
        })
    } catch (error) {
        const err = new Error("Admin logout server error");
        return next(err);
    }
 }

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    logout

}