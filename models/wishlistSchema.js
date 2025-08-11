const mongoose = require ("mongoose")

const wishlistSchema = new mongoose.Schema({
    userId:{
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    products: [
        {
            productId: {
                type: Schema.Types.ObjectId,
                ref: "Product",
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