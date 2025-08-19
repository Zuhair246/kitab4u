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


module.exports = {
    loadLogin
}