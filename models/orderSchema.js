const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const Address = require("../models/addressSchema");

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  orderedItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      coverType: {
        type: String,
        required: true,
      },
      image: {
        type: String,
        required: true,
      },
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  address: {
    type: Address.schema,
    required: true,
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
    ],
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  CouponApplied: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Order", orderSchema);
