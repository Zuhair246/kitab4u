const mongoose = require ('mongoose')

const cartSchema = mongoose.Schema ({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"User",
        required: true
    },
    items: [
        {
            productId: {
            type:  mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
            },
            variantId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            quantity: {
                type: Number,
                default: 1
            },
            price: {
                type: Number,
                required: true
            },
            totalPrice: {
                type: Number,
                required: true
            },
        }
    ]
})

module.exports = mongoose.model("Cart",cartSchema)