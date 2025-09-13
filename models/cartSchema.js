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
            type:  mongoose.Schema.Types.ObjectId,
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
        }
    ]
})

module.exports = mongoose.model("Cart",cartSchema)