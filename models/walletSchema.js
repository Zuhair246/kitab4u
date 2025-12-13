import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [
        {
            transactionType: {
                type: String,
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            date: {
                    type: Date,
                    required: true
            },
            description: {
                type: String
            }
        }
    ]
},
{timestamps: true}
);

export default mongoose.model('Wallet', walletSchema);