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
            type: String,
            required: true,
            match: /^[0-9]{6}$/
        },
        phone: {
            type: String,
            required: true,
            match: /^[0-9]{10}$/
        },
        altPhone: {
            type: String,
            required: false,
            match: /^[0-9]{10}$/
        },
        isDefault: {
            type: Boolean,
            default: false
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
