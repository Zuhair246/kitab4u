import mongoose from 'mongoose';
import { orderID } from '../helpers/nanoGenerator.js';

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderId: {
    type: String,
    default: orderID,
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
      salePrice: {
        type: Number,
        required: true
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
      itemStatus: {
        type: String,
        enum: [      
          "Pending",
          "Placed",
          "Packed",
          "Shipped",
          "Out for Delivery",
          "Delivered",
          "Cancelled",
          "Return Requested",
          "Returned",
          "Return Rejected"
        ],
        default: 'Pending'
      },
      returnReason: {
        type: String
      },
      cancelReason: {
      type: String
    }
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
  shippingCharge: {
    type: Number,
    default: 0,
    required: true
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  finalPayableAmount: {
    type: Number,
    default: 0
  },
  shippingAddress: {
      name: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
       streetAddress: {
            type: String,
            required: true,
        },
        state: {
            type: String,
            required: true
        },
        pinCode: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        altPhone: {
            type: String,
            required: false,
        },
       addressType: {
          type: String,
          required: true
      },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
  paymentMethod: {
    type: String,
    enum: [
                  'COD' , 
                  'Online',
                  'Wallet'
                ],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: [
                  'Pending' , 
                  'Paid' , 
                  'Failed' , 
                  'Refunded'
                ],
    default: 'Pending'
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
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
      "Placed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Return Requested",
      "Returned",
      "Return Rejected"
    ],
    default: 'Pending'
  },
  returnReason: {
    type: String
  },
  cancelReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
});

export default mongoose.model("Order", orderSchema);
