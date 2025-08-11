const mongoose = require ('mongoose')

const cartSchema = mongoose.Schema ({
    userId: {
        type: Schema.Types.ObjectId,
        ref:"User",
        required: true
    },
    items: [
        {
            productId: {
            type:  Schema.Types.ObjectId,
            ref: "Product",
            required: true
            },
            quantity: {
                type: Number,
                dafault: 1
            },
            price: {
                type: Number,
                required: true
            },
            totalPrice: {
                type: Number,
                required: true
            },
            status: {
                type: String,
                default: "Placed"
            },
            cancellationReason: {
                type: String,
                default: "none"
            },
        }
    ]
})

module.exports = mongoose.model("Cart",cartSchema)