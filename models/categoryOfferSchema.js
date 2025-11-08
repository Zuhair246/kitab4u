const mongoose = require('mongoose');
const { ref } = require('pdfkit');

const categoryOfferSchema = new mongoose.Schema({
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    discountPercentage: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    }
},
{timestamps: true}
);

module.exports = mongoose.model('categoryOffer', categoryOfferSchema);