const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referredUser:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    redeemedUsers: [{
        userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
        },
        redeemedOn: {
            type: Date,
            default: Date.now()
        }
    }],
    totalEarned: {
        type: Number,
        default: 0,
        min: 0
    },
},
{timestamps: { createdAt: true, updatedAt: false} }
);

referralSchema.index({ referredUser: 1});

module.exports = mongoose.model("Referral", referralSchema);