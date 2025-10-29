const mongoose = require ("mongoose")

const wishlistSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            variantId:{
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            addedOn: {
                type: Date,
                default: Date.now
            }
        }
    ]
})

module.exports = mongoose.model("Wishlist",wishlistSchema)