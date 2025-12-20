import User from '../../models/userSchema.js';
import Product from '../../models/productSchema.js';
import Cart from '../../models/cartSchema.js';
import Address from '../../models/addressSchema.js';
import Order from '../../models/orderSchema.js';
import Payment from '../../models/paymentSchema.js';
import Wallet from '../../models/walletSchema.js';
import { addToWallet } from '../../helpers/walletHelper.js';
import Coupon from '../../models/couponSchema.js';
import { calculateDiscountedPrice } from '../../helpers/offerPriceCalculator.js';
import razorpay from '../../config/razorpay.js';
import crypto from 'crypto';
import path from 'path';
import PDFDocument from 'pdfkit';
import { statusCodes } from '../../helpers/statusCodes.js';
import mongoose from 'mongoose';
const { OK, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND, CONFLICT, PAYMENT_REQUIRED } = statusCodes;

const loadCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.user?._id;
    if (!userId) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }

    const addressDocs = await Address.find({ userId: user._id }).lean();
    const existingAddress = addressDocs
      .map((doc) =>
        doc.address ? doc.address.filter((addr) => !addr.isDeleted) : []
      )
      .flat();
    const allAddresses = existingAddress;

    const sortedAddresses = allAddresses.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const recentAddresses = sortedAddresses.slice(0, 1);

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: {
        path: "categoryId",
        model: "Category",
        match: { isListed: true },
      },
    });

    let cartItems = [];
    if (cart && cart.items.length > 0) {
      cartItems = cart.items.filter(
        (item) => item.productId && item.productId.categoryId
      );
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(BAD_REQUEST).redirect("/cart?error=" + encodeURIComponent("Cart is empty"));
    }

    let items = await Promise.all(
      cartItems.map(async (item) => {
        const product = item.productId;
        const variant = product.variants.id(item.variantId);

        const pricing = await calculateDiscountedPrice({
          _id: product._id,
          discountPrice: variant.discountPrice,
          originalPrice: variant.originalPrice,
          categoryId: product.categoryId,
        });

        const price =
          pricing.finalPrice || variant.discountPrice || variant.originalPrice;
        const image =
          product.images && product.images.length > 0
            ? product.images[0]
            : null;

        return {
          productId: product._id,
          variantId: variant._id,
          name: product.name,
          coverType: variant.coverType,
          quantity: item.quantity,
          salePrice: variant.discountPrice,
          price: price,
          image: image,
          totalPrice: item.quantity * price,
          isBlocked: product.isBlocked,
          stock: variant.stock,
        };
      })
    );

    if (items.some((item) => item.isBlocked)) {
      return res.status(CONFLICT).redirect(
        "/cart?error=" +
          encodeURIComponent(
            "Some of your products are unavailable \nPlease remove it and proceed"
          )
      );
    } else if (items.some((item) => item.stock <= 0)) {
      return res.status(CONFLICT).redirect(
        "/cart?error=" +
          encodeURIComponent(
            "Some of the products in cart are out of stock, Please remove it and proceed"
          )
      );
    }

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    let shippingCharge = 0;
    if (subtotal < 700) {
      shippingCharge = 50;
    }
    const finalAmount = subtotal + shippingCharge;
    let discountFinalAmount = 0;
    let discount = 0;
    let coupons = await Coupon.find({
      isActive: true,
      usedUsers: { $ne: userId },
    });
    const wallet =  await Wallet.findOne({userId});
    const userWallet =  wallet ? wallet : "";
    let session = req.session;
    
    return res.status(OK).render("checkout", {
      user,
      items,
      subtotal,
      shippingCharge,
      finalAmount,
      discountFinalAmount,
      discount,
      userWallet,
      coupons,
      session,
      addresses: recentAddresses,
      allAddresses,
    });
  } catch (error) {
    console.log(error);
    
    const err = new Error("Order page load server error!");
    return next (err);
  }
};

const checkout = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }

    const { selectedAddressId, paymentMethod } = req.body;

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: {
        path: "categoryId",
        model: "Category",
        match: { isListed: true },
      },
    });

    let cartItems = [];
    if (cart && cart.items.length > 0) {
      cartItems = cart.items.filter(
        (item) => item.productId && item.productId.categoryId
      );
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(CONFLICT).redirect("/cart?error=" + encodeURIComponent("Cart is empty"));
    }

    let items = await Promise.all(
      cartItems.map(async (item) => {
        const product = item.productId;
        const variant = product.variants.id(item.variantId);

        const pricing = await calculateDiscountedPrice({
          _id: product._id,
          discountPrice: variant.discountPrice,
          originalPrice: variant.originalPrice,
          categoryId: product.categoryId,
        });

        const price =
          pricing.finalPrice || variant.discountPrice || variant.originalPrice;
        const image =
          product.images && product.images.length > 0
            ? product.images[0]
            : null;

        return {
          product: product._id,
          variantId: variant._id,
          name: product.name,
          coverType: variant.coverType,
          quantity: item.quantity,
          salePrice: variant.discountPrice,
          price: price,
          totalPrice: item.quantity * price,
          image: image,
          isBlocked: product.isBlocked,
          stock: variant.stock,
        };
      })
    );

    if (items.some((item) => item.isBlocked)) {
      return res.status(CONFLICT).redirect(
        "/cart?error=" +
          encodeURIComponent(
            "Some of your products are Un-available, Please remove it and proceed !"
          )
      );
    } else if (items.some((item) => item.stock <= 0)) {
      return res.status(CONFLICT).redirect(
        "/cart?error=" +
          encodeURIComponent(
            "Some of your products in cart are out of stock, Please remove it and proceed...."
          )
      );
    }

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    let shippingCharge = 0;
    if (subtotal < 700) {
      shippingCharge = 50;
    }
    const finalAmount = subtotal + shippingCharge;
    let discount = 0;
    const addressDoc = await Address.findOne(
      { userId, "address._id": selectedAddressId },
      { "address.$": 1 }
    ).lean();

    if (!addressDoc || !addressDoc.address[0]) {
      return res.status(BAD_REQUEST).redirect(
        "/orders?error=" + encodeURIComponent("Invalid Address Selection")
      );
    }
    const selectedAddress = addressDoc.address[0];
    selectedAddress.userId = userId;

    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();

    let appliedCoupon = req.session.appliedCoupon;
    let discountFinalAmount = 0;
    if (!appliedCoupon) {
      delete req.session.appliedCoupon;
      appliedCoupon = null;
    } else {
      discountFinalAmount = appliedCoupon
        ? appliedCoupon.discountFinalAmount
        : 0;
      discount = Math.round(appliedCoupon.discountAmount);
    }

     if(appliedCoupon){
        const couponFromDb = await Coupon.findOne({ code: appliedCoupon.couponCode});
        if(!couponFromDb || !couponFromDb.isActive){
          return res.status(BAD_REQUEST).json({ 
                      success: false, 
                      message: "Coupon is unavailable at the moment \nPlease remove the coupon and proceed!"})
        }
      }

    const finalPayableAmount =
      discountFinalAmount > 0 ? discountFinalAmount : finalAmount;

    if (!paymentMethod) {
      return res.status(BAD_REQUEST).redirect(
        "/orders?error=" + encodeURIComponent("Please Select a Payment Method")
      );
    }

    if (paymentMethod === "COD") {
      if(finalPayableAmount>1000) {
        return res.status(CONFLICT).redirect("/orders?error=" + encodeURIComponent("Order above ₹1000/- can't be COD"))
      } 
      const newOrder = new Order({
        userId,
        orderedItems: items,
        totalPrice: subtotal,
        shippingCharge,
        finalAmount,
        finalPayableAmount,
        discount,
        shippingAddress: selectedAddress,
        couponApplied: appliedCoupon ? true : false,
        paymentMethod: "COD",
        paymentStatus: "Pending",
        status: "Placed",
        createdAt: new Date(),
      });
      await newOrder.save();

      for (const item of items) {
        await Product.updateOne(
          { _id: item.product, "variants._id": item.variantId },
          { $inc: { "variants.$.stock": -item.quantity } }
        );
      }

      await Cart.updateOne({ userId }, { $set: { items: [] } });

      if (req.session.appliedCoupon?.couponCode) {
        await Coupon.updateOne(
          { code: req.session.appliedCoupon.couponCode },
          { $addToSet: { usedUsers: userId } }
        );
        delete req.session.appliedCoupon;
      } else {
        delete req.session.appliedCoupon;
      }

      return res.status(OK).render("orderSuccess", {
        orderId: newOrder.orderId,
        user,
        orders,
      });
    } else if (paymentMethod === "Online") {
      const receiptId = `receipt_${Date.now()}`;
      const options = {
        amount: finalPayableAmount * 100,
        currency: "INR",
        receipt: receiptId,
      };
      const razorpayOrder = await razorpay.orders.create(options);

      const newOrder = new Order({
        userId,
        orderedItems: items,
        totalPrice: subtotal,
        shippingCharge,
        finalAmount,
        finalPayableAmount,
        discount,
        shippingAddress: selectedAddress,
        couponApplied: appliedCoupon ? true : false,
        paymentMethod: "Online",
        paymentStatus: "Pending",
        status: "Pending",
        createdAt: new Date(),
      });
      await newOrder.save();

      const newPayment = new Payment({
        orderId: newOrder.orderId,
        method: "Online",
        status: "Pending",
        amount: finalPayableAmount,
        gateway: "Razorpay",
        transactionId: razorpayOrder.id,
      });
      await newPayment.save();

      newOrder.paymentId = newPayment._id;
      await newOrder.save();

      return res.status(OK).json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderId: razorpayOrder.id,
        orderDbId: newOrder.orderId,
      });
    }else if(paymentMethod === "Wallet"){
      const wallet = await Wallet.findOne({userId});
      if (!wallet) {
        return res.status(400).json({ success: false, message:"Wallet not found!" })
      }
      if(wallet.balance < finalPayableAmount){
        return res.status(400).json({ success: false, message: "Insufficient wallet balance!"})
      }

      const newOrder = await Order.create({
        userId,
        orderedItems: items,
        totalPrice: subtotal,
        shippingCharge,
        finalAmount,
        finalPayableAmount,
        discount,
        shippingAddress: selectedAddress,
        couponApplied: !!appliedCoupon,
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
        status: "Placed",
        createdAt: new Date(),
      })
      
     await addToWallet(userId, finalPayableAmount, 'Debit', `Paid towards the Order: #${newOrder._id}`);
    
      for (const item of items) {
        await Product.updateOne(
          { _id: item.product, "variants._id": item.variantId },
          { $inc: { "variants.$.stock": -item.quantity } }
        );
      }

      await Cart.updateOne({ userId }, { $set: { items: [] } });

      if (req.session.appliedCoupon?.couponCode) {
        await Coupon.updateOne(
          { code: req.session.appliedCoupon.couponCode },
          { $addToSet: { usedUsers: userId } }
        );
        delete req.session.appliedCoupon;
      } else {
        delete req.session.appliedCoupon;
      }

    return res.status(200).json({ success: true, orderId: newOrder._id})
    }
  } catch (error) {
    console.log(error);
    
    const err = new Error("Order checkout server error");
    throw err;
  }
};

const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(UNAUTHORIZED).redirect("/login");
    }
    const user = await User.findById(userId).session(session);
    if(!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(UNAUTHORIZED).json({ success: false, message: "User not found!"})
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderDbId,
    } = req.body;

    const paymentDoc = await Payment.findOne({ orderId: orderDbId }).session(session);
    if(paymentDoc?.status === "Paid") {
      await session.abortTransaction();
      session.endSession();
      return res.status(CONFLICT).json({ success: false, message: "Payment already processed!"})
    }

    const responseSnapshot = { ...req.body };

    //Payment failure
    if (!razorpay_signature || !razorpay_payment_id || !razorpay_order_id) {
      if (paymentDoc) {
        paymentDoc.status = "Failed";
        paymentDoc.paymentId = razorpay_payment_id || null;
        paymentDoc.transactionId = razorpay_payment_id || paymentDoc.transactionId;
        paymentDoc.responseData = responseSnapshot;
        await paymentDoc.save({ session });
      }
      await Order.updateOne(
        { orderId: orderDbId },
        {
          paymentStatus: "Failed",
          status: "Pending"
        },
        { session }
      );
      await session.commitTransaction();
      session.endSession();
      return res.status(PAYMENT_REQUIRED).json({
        success: false,
        redirect: `/loadRetryPayment?orderId=${orderDbId}`,
      });
    }

    //Success Payment Verification
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature === razorpay_signature) {
      if (paymentDoc) {
        paymentDoc.status = "Paid";
        paymentDoc.paymentId = razorpay_payment_id;
        paymentDoc.responseData = responseSnapshot;
        await paymentDoc.save( { session } );
      }
      await Order.updateOne(
        { orderId: orderDbId },
        {
          paymentStatus: "Paid",
          status: "Placed"
        },
        { session }
      )

      // Reduce stock only after successful payment
      const order = await Order.findOne({orderId: orderDbId})
                .populate("orderedItems.product")
                .session(session);
      if(!order){
        await session.abortTransaction();
        session.endSession();
        return res.status(NOT_FOUND).json({ success: false, message: "Order not found!"})
      }
      for (const item of order.orderedItems) {
        const updated = await Product.updateOne(
          { _id: item.product, "variants._id": item.variantId },
          { $inc: { "variants.$.stock": -item.quantity } },
          { session }
        );
        if(updated.modifiedCount === 0) {
           throw new Error("Stock update failed!");
        }
      }

      await Cart.updateOne( { userId }, { $set: { items: [] } }, { session } );

      if (req.session.appliedCoupon?.couponCode) {
        await Coupon.updateOne(
          { code: req.session.appliedCoupon.couponCode },
          { $addToSet: { usedUsers: userId } },
          { session }
        );
        delete req.session.appliedCoupon;
      } else {
        delete req.session.appliedCoupon;
      };
      await session.commitTransaction();
      session.endSession();

      return res.status(OK).json({ success: true, orderId: orderDbId });
    } else {
      //Signature exists but mismatch happened
      if (paymentDoc) {
        paymentDoc.status = "Failed";
        paymentDoc.responseData = responseSnapshot;
        await paymentDoc.save({ session });
      }
      await Order.updateOne(
        { orderId: orderDbId },
        {
          paymentStatus: "Failed",
          status: "Pending"
        },
        { session }
      );
      await session.commitTransaction();
      session.endSession();
      return res.status(UNAUTHORIZED).json({
        success: false,
        redirect: `/loadRetryPayment?orderId=${orderDbId}`,
      });
    }
  } catch (error) {
    if(session.inTransaction()){
      await session.abortTransaction();
    }
    session.endSession();
    const err = new Error("Payment verification server error!");
    throw err;
  }
};

const loadRetryPayment = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }
    const user = await User.findById(userId);
    const { orderId } = req.query;
    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .lean();
    return res.status(OK).render("retryPayment", {
      user,
      order,
    });
  } catch (error) {
    const err = new Error("Retry payment page load server error")
    return next (err);
  }
};

const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId).lean();
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found!" });

    if (order.paymentStatus === "Paid") {
      return res
        .status(400)
        .json({ success: false, message: "Order already Paid!" });
    }

    const receiptId = `reciept_retry_${Date.now()}`;
    const options = {
      amount: order.finalPayableAmount * 100,
      currency: "INR",
      receipt: receiptId,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    let paymentDoc = await Payment.findOne({ orderId: orderId });
    if (!paymentDoc) {
      paymentDoc = new Payment({
        orderId: orderId,
        method: "Online",
        status: "Pending",
        amount: order.finalPayableAmount,
        gateway: "Razorpay",
        transactionId: razorpayOrder.id,
      });
    } else {
      paymentDoc.status = "Pending";
      paymentDoc.amount = order.finalPayableAmount;
      paymentDoc.transactionId = razorpayOrder.id;
      paymentDoc.responseData = null;
      paymentDoc.paymentId = null;
    }
    await paymentDoc.save();

    return res.status(OK).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: razorpayOrder.id,
      orderDbId: orderId,
    });
  } catch (error) {
    const err = new Error("Internal server error while retry payment.")
    return next (err);
  }
};

const orderSuccess = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }
    const user = await User.findById(userId);
    const {orderId} = req.query;

    const order = await Order.findOne({orderId}).populate(
      "orderedItems.product"
    );
    if(!order){
      return res.status(404).render('404-page');
    }
     return res.status(OK).render("orderSuccess", {
      user,
      order,
      orderId
    });
  } catch (error) {
    console.log(error);
    
    const err = new Error("Order success page load server error!");
    throw err;
  }
};

const orderHistory = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const search = req.query.search ? req.query.search.trim() : null;

    let query = { userId };

    if (search) {
      query = {
        userId,
        $or: [
          { orderId: { $regex: `^${search}`, $options: "i" } },
          { status: { $regex: `^${search}`, $options: "i" } },
          { "orderedItems.name": { $regex: `^${search}`, $options: "i" } },
        ],
      };
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalItems = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    const formattedOrders = orders.map((order) => {
      const orderStatus = [
        "Pending",
        "Placed",
        "Packed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Return Requested",
        "Returned",
      ];
      const statusIndex = orderStatus.indexOf(order.status);

      return {
        ...order,
        items: order.orderedItems,
        statusIndex: statusIndex === -1 ? 0 : statusIndex,
        expectedDeliveryDateFormatted: new Date(
          order.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000
        ).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
    });

     return res.status(OK).render("orderHistory", {
      orders: formattedOrders,
      user,
      search,
      totalItems,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    const err = new Error("Order history page loading server error")
    return next (err);
  }
};

const orderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user || req.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }

    const order = await Order.findOne({ _id: id, userId }).lean();
    if (!order) {
      return res.status(NOT_FOUND).redirect("/myOrders");
    }

    const orderDate = new Date(order.createdAt);
    const expectedDelivery = new Date(
      order.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    const formatDate = (date) =>
      date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    order.orderDateFormatted = formatDate(orderDate);
    order.expectedDeliveryDateFormatted = formatDate(expectedDelivery);

    const statusStages = [
      "Pending",
      "Placed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
    ];
    order.statusIndex = statusStages.indexOf(order.status);

    order.items = order.orderedItems.map((item) => ({
      ...item,
      totalPrice: item.price * item.quantity,
    }));

    order.canCancel = ["Pending", "Placed", "Packed"].includes(order.status);
    order.canReturn = order.status === "Delivered";

    order.address = order.shippingAddress;
    order.subtotal = order.totalPrice;
    order.shippingCharge = order.shippingCharge;

     return res.status(OK).render("orderDetails", {
      user,
      order,
    });
  } catch (error) {
    const err = new Error("Order details page loading server error");
    return next (err);
  }
};

const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }
    const orderId = req.params.id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason for cancellation required !",
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (!["Pending", "Placed","Packed"].includes(order.status)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cannot cancel the order after shipping",
        });
    }

    for(let item of order.orderedItems) {
      item.itemStatus = "Cancelled";
      item.cancelReason = reason;
    
      const product = await Product.findById(item.product);
      const variant = product?.variants.id(item.variantId);
      if(order.status !== 'Pending'){
        if(variant) {
          variant.stock += item.quantity;
          await product.save();
        }
      }
    }

    order.status = "Cancelled";
    order.cancelReason = reason;

if(order.paymentMethod=='Online' || order.paymentMethod=="Wallet") {
  if(order.paymentStatus=="Paid"){
    await addToWallet(order.userId, order.finalPayableAmount, "Credit", `Refund for order: #${order.orderId}`)
  }
}

    await order.save();

    return res.status(OK).json({
      success: true,
      message: "Order Cancelled Successfully",
    });
  } catch (error) {
    const err = new Error("Order cancelling server error");
    return next (err);
  }
};

const cancelSingleItem = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.status(UNAUTHORIZED).redirect('/login');
    } 
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    if (!["Pending", "Placed", "Packed"].includes(item.itemStatus)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Item cannot be cancelled after shipping",
        });
    }

    if (!reason) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Reason for item cancellation is neceesary",
        });
    }

    
    const allCancelled = order.orderedItems.every(
      (it) => it.itemStatus === "Cancelled"
    );
    if (allCancelled) {
      order.status = "Cancelled";
      order.cancelReason = reason;
    }
    
    const product = await Product.findById(item.product);
    const variant = product?.variants.id(item.variantId);
    if(variant && order.status !== "Pending"){
      variant.stock += item.quantity;
      await product.save();
    }
    
    item.itemStatus = "Cancelled";
    item.cancelReason = reason;

    let itemRefundAmount = 0;
    let itemDiscount = 0;
     itemRefundAmount = item.price * item.quantity;
        if(order.couponApplied && order.discount>0 && order.finalPayableAmount >0) {
          const share = (item.price * item.quantity) / order.totalPrice;
           itemDiscount = Math.round(order.discount * share);
          itemRefundAmount -= itemDiscount;
        }
        order.totalPrice -= item.price * item.quantity;
        order.finalPayableAmount -= itemRefundAmount;
        if(order.shippingCharge == 0  && order.totalPrice < 700) {
          order.shippingCharge = 50;
          order.finalPayableAmount += 50;
        }
        if(allCancelled && order.totalPrice < 700) {
          itemRefundAmount += order.shippingCharge;
        }
    if(order.paymentMethod=="Online" || order.paymentMethod=="Wallet") {
      if(order.paymentStatus=="Paid") {
        if(allCancelled) {
          order.paymentStatus = "Refunded"
        }
        await addToWallet(order.userId, itemRefundAmount, "Credit", `Refund for cancelled item: "${item.name}" in the order: #${order.orderId}`)
      }
    }
    await order.save();

    return res.status(OK).json({ success: true, message: `"${item.name} Cancelled"` });
  } catch (error) {
    const err = new Error("Single item cancelling server error");
    return next (err);
  }
};

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if(!userId) {
      return res.status(UNAUTHORIZED).redirect('/login')
    }
    const orderId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Return reason is needed" });
    }
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const returnLimit = new Date(
      order.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000
    );

    if (order.status !== "Delivered") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cannot return the order before delivering",
        });
    }

    if (Date.now() > returnLimit) {
      return res
        .status(400)
        .json({ success: false, message: "Return period over" });
    }

    order.status = "Return Requested";
    const activeItems = order.orderedItems.filter(item => ![ 'Cancelled' , 'Returned' ].includes(item.itemStatus))
    activeItems.forEach((item) => {
      item.itemStatus = "Return Requested";
    });
    order.returnReason = reason;

    await order.save();

    return res
      .status(200)
      .json({ success: true, message: "Return requested successfully" });
  } catch (error) {
    const err = new Error("Order return request server error");
    return next (err);
  }
};

const returnSingleItem = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.status(UNAUTHORIZED).redirect("/login");
    }
    const { orderId, itemId } = req.params;

    const { reason } = req.body;
    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Return reason is necessary!" });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found !" });
    }

    const item = order.orderedItems.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    if (item.itemStatus !== "Delivered") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cannot return item before delivering !",
        });
    }

    const returnLimit = new Date(
      order.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000
    );
    if (Date.now() > returnLimit) {
      return res
        .status(400)
        .json({ success: false, message: "Return period finished" });
    }

    item.itemStatus = "Return Requested";
    item.returnReason = reason;

    const allReturned = order.orderedItems.every(
      (item) => item.itemStatus === "Return Requested"
    );
    if (allReturned) {
      order.status = "Return Requested";
      order.returnReason = reason;
    }

    await order.save();

    return res
      .status(200)
      .json({ success: true, message: `Return requested for ${item.name}` });
  } catch (error) {
    const err = new Error("Item return request server error");
    return next (err);
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, userId }).lean();
    if (!order) {
      return res.status(NOT_FOUND).redirect("/myOrders");
    }

    res.setHeader(
      "Content-Disposition",
      `attachement; filename=Invoice-${order.orderId}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    const logo = path.join(__dirname, "../../public/images/logo.png");
    doc.image(logo, 40, 20, {width:80})

    doc
      .fillColor("#c93f1c")
      .fontSize(25)
      .font("Times-BoldItalic")
      .text("INVOICE", { align: "center", underline: true });
    doc.moveDown(1.5);

    doc
      .fontSize(14)
      .fillColor("#34495e")
      .font("Times-Bold")
      .text("Order Details:", { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .fillColor("#091fe3")
      .font("Times-Italic")
      .text(`Order ID: ${order.orderId}`)
      .text(
        `Order Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`
      )
      .text(
        `Expected Delivery: ${new Date(
          order.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000
        ).toLocaleDateString("en-IN")}`
      );
    // .text(`Invoice date: ${new Date.now().getTime().toLocaleDateString('en-IN')}`, 350, doc.y, { width: 100, align: 'right' })

    doc
      .fontSize(12)
      .fillColor("#f90000ff")
      .text(`Order Status: ${order.status}`)
      .moveDown(1);

    doc
      .fontSize(12)
      .fillColor("#2596be")
      .text(`Payment Method: ${order.paymentMethod}`)
      .moveDown(1);

    doc
      .fontSize(14)
      .fillColor("#34495e")
      .font("Times-Bold")
      .text("Shipping Address:", { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .fillColor("#091fe3")
      .font("Times-Italic")
      .text(`Name: ${order.shippingAddress.name}`)
      .text(
        `Phone: ${order.shippingAddress.phone}, ${order.shippingAddress.altPhone}`
      )
      .text(
        `Address: ${order.shippingAddress.streetAddress}, ${order.shippingAddress.city} 
                ${order.shippingAddress.state}, ${order.shippingAddress.pinCode}`
      )
      .moveDown(1);

    doc
      .font("Times-Bold")
      .fillColor("#34495e")
      .fontSize(14)
      .text("Ordered Items: ", { underline: true })
      .moveDown(0.5);

    // Table Header
    doc
      .fontSize(12)
      .fillColor("#2c3e50")
      .font("Times-Bold")
      .text("Item", 50, doc.y, { continued: true })
      .text("Qty", 280, doc.y, { continued: true })
      .text("Price", 350, doc.y, { continued: true })
      .text("Total", 400, doc.y, { continued: true })
      .text("Status", 450);

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(600, doc.y).stroke("#aaa");
    doc.moveDown(0.5);

    // Items
    doc.font("Times-Roman").fillColor("#000");
    order.orderedItems.forEach((item) => {
      const itemY = doc.y;
      const total = item.price * item.quantity;

      doc.text(`${item.name} (${item.coverType})`, 50, itemY, { width: 250 });
      doc.text(`${item.quantity}`, 310, itemY, { width: 50 });
      doc.text(`Rs: ${item.price}`, 390, itemY, { width: 80 });
      doc.text(`Rs: ${total}`, 470, itemY, { width: 100 });
      doc.text(`${item.itemStatus}`, 540, itemY, { width: 100 }).moveDown(0.3);
    });

    doc.moveDown(3);

    // === Totals ===
    let currenY = doc.y;
    doc
      .fontSize(12)
      .font("Times-Bold")
      .fillColor("#2c3e50")
      .text("Subtotal:", 350, currenY, {
        continued: true,
        width: 100,
        align: "left",
      })
      .font("Times-Roman")
      .fillColor("#000")
      .text(`Rs: ${order.totalPrice}`, 450, currenY-5, { align: "right" })
      .moveDown(0.3);

    currenY = doc.y;
    doc
      .font("Times-Bold")
      .fillColor("#2c3e50")
      .text("Shipping Charge:", 350, currenY, {
        continued: true,
        width: 100,
        align: "left",
      })
      .font("Times-Roman")
      .fillColor("#000")
      .text(`Rs: ${order.shippingCharge || 0}`, 450, currenY-15, {
        align: "right",
      })
      .moveDown(0.3);

    currenY = doc.y;
    doc
      .font("Times-Bold")
      .fillColor("#2c3e50")
      .text("Discount:", 350, currenY, {
        continued: true,
        width: 100,
        align: "left",
      })
      .font("Times-Roman")
      .fillColor("#fb0000ff")
      .text(`- Rs: ${order.discount || 0}`, 450, currenY, { align: "right" })
      .moveDown(0.3);

    doc.moveTo(350, doc.y).lineTo(550, doc.y).stroke("#aaa").moveDown(0.3);

    doc
      .fontSize(14)
      .font("Times-Bold")
      .fillColor("#2c3e50")
      .text("Total Amount:", 350, doc.y, {
        continued: true,
        width: 100,
        align: "left",
      })
      .font("Times-Bold")
      .fillColor("#000")
      .text(`Rs: ${order.finalAmount}`, 450, doc.y-15, { align: "right" })
      .moveDown(2);

    // === Footer ===
    doc
      .fontSize(10)
      .fillColor("#c93f1c")
      .font("Times-Italic")
      .text("Thank you for shopping with Kitab4U!", { align: "center" })
      .text("For queries, contact: support@kitab4u.com", { align: "center" });

    doc.end();
  } catch (error) {
    const err = new Error("Invoice download server error!");
    return next (err);
  }
};

export default {
  loadCheckoutPage,
  checkout,
  orderHistory,
  orderDetails,
  cancelOrder,
  cancelSingleItem,
  returnOrder,
  returnSingleItem,
  downloadInvoice,
  verifyPayment,
  loadRetryPayment,
  retryPayment,
  orderSuccess,
};
