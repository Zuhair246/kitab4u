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
        console.log("Admin login loading error:", error);
        res.status(500).send("Internal server error")
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
                req.session.admin = true;
                return res.redirect('/admin/dashboard')
            }else {
                return res.render('adminLogin', {message: "Wrong password"})
            }
        }else {
            return res.render('adminLogin', {message: "You are not admin"})
        }
       
    } catch (error) {
        console.log("Login page error:",error);
    }
}

const loadDashboard = async (req, res) => {
    if(req.session.admin) {
        try {
            res.render('dashboard')
        } catch (error) {
            res.render('pageNotFound')
        }
    }
}

 const logout = async (req,res) => {
    try {
        req.session.admin = null;
        return res.redirect('/admin');
    } catch (error) {
        console.log("Unexpexxted server error during admin logout:", error);
        res.redirect('/pageNotFound')
    }
 }

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    logout

}