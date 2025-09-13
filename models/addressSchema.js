const mongoose = require ("mongoose")

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    address : [{
        addressType:{
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
       streetAddress: {
            type: String,
            required: true,
        },
        state: {
            type: String,
            required: true
        },
        pinCode: {
            type: Number,
            required: true
        },
        phone: {
            type: Number,
            required: true
        },
        altPhone: {
            type: Number,
            required: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
})

module.exports = mongoose.model("Address",addressSchema)
