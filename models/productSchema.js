const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  coverType: {
    type: String,
    required: true
  },
  originalPrice: { 
    type: Number,
    required: true 
},
  discountPrice: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function (value) {
        if (value === null) return true;
        return value <= this.originalPrice;
      },
      message: "Discount price must be less than or equal to original price"
    }
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
});


const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  author: {
    type: String,
    required: true
  },
  publisher:{
    type: String,
    required:true
  },
  pages:{
    type: Number,
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  variants: [variantSchema],
  images: [
        {
          type: String,
          required: true,
        }
      ],
  isBlocked: {
    type: Boolean,
    default: false
  },
},
{
  timestamps: true
});

module.exports = mongoose.model("Product", productSchema);
