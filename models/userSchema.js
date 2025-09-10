const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
         type: String,
         required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    googleId: {
        type: String,
        unique:true,
        sparse:true
    },
    password: {
        type: String,
        required: false,
    },
    phone: {
        type: Number,
        required: false,
        unique: true,
        sparse: true,
    },
    isBlocked: {
        type: Boolean,
        default:false
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    isVerified:{
        type:Boolean,
        default:false
    },
    image: {
        type: String,
        required: false
    },
    // cart: [{
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Cart"
    // }],
    // wallet: [{
    //     type: Number,
    //     default: 0
    // }],
    // wishlist: [{
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Wishlist"
    // }],
    // orderHistory: [{
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "order"
    // }],
    // createdOn: {
    //     type: Date,
    //     default: Date.now,
    // },
    // referralCode: {
    //     type: String,
    // },
    // redeemed: {
    //     type: Boolean
    // },
    // redeemedUsers: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User"
    // },
    searchHistory: [{
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category"
        },
      searchOn: {
        type: Date,
        default: Date.now
      }  
    }]
})

module.exports  = mongoose.model("User", userSchema)
