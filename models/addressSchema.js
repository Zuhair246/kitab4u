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
            reuired: true
        },
        name: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        landMark: {
            type: String,
            required: true,
        },
        state: {
            type: String,
            requied: true
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
        }
    }]
})

module.exports = mongoose.model("Address",addressSchema)
