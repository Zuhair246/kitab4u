const mongoose = require("mongoose")

const bannerSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true
    },
    title:{
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    }
})

module.exports = mongoose.model('Banner', bannerSchema)