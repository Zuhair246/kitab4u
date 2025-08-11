const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  variants: [
    {
      languageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Language",
        required: true
      },
      originalPrice: {
        type: Number,
        required: true,
      },
      discountPrice: {
        type: Number,
        required: true,
      },
      stock: {
        type: Number,
        required: true,
      },
      images: [
        {
          type: String,
          required: true,
        },
      ],
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      isBlocked: {
        type: Boolean,
        default: false
      },
      status: {
        type: String,
        enum: ["Available","Out Of Stock"],
        required: true,
        default: "Available"
      }
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Product", productSchema);
