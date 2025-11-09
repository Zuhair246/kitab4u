const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    method: {
        type: String,
        enum: ['COD' , 'Online']
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    amount: {
        type: Number,
        required: true
    },
    transactionId: {
        type: String,
        unique: true
    },
    paymentId: {
        type: String,
    },
    gateway: {
        type: String
    },
    responseData: {
        type: Object    //response from payment gateways like -  "method": "card", "card": { "last4": "1111" ,  "network": "Visa" }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Payment', paymentSchema);