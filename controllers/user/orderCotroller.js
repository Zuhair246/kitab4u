const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Payment = require("../../models/paymentSchema");
const Coupon = require("../../models/couponSchema");
const calculateDiscountedPrice = require("../../helpers/offerPriceCalculator");
const razorpay = require("../../config/razorpay");
const crypto = require("crypto");
const path = require("path");
const PDFDocument = require("pdfkit");

const loadOrderPage = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
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
      return res.redirect("/cart?error=" + encodeURIComponent("Cart is empty"));
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
          price: price,
          image: image,
          totalPrice: item.quantity * price,
          isBlocked: product.isBlocked,
          stock: variant.stock,
        };
      })
    );

    if (items.some((item) => item.isBlocked)) {
      return res.redirect(
        "/cart?error=" +
          encodeURIComponent(
            "Some of your products are unavailable \nPlease remove it and proceed"
          )
      );
    } else if (items.some((item) => item.stock <= 0)) {
      return res.redirect(
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
    let session = req.session;
    res.render("checkout", {
      user,
      items,
      subtotal,
      shippingCharge,
      finalAmount,
      discountFinalAmount,
      discount,
      coupons,
      session,
      addresses: recentAddresses,
      allAddresses,
    });
  } catch (error) {
    console.log("Order page load error:", error);
    res.redirect("/pageNotFound");
  }
};

const checkout = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
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
      return res.redirect("/cart?error=" + encodeURIComponent("Cart is empty"));
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
          price: price,
          totalPrice: item.quantity * price,
          image: image,
          isBlocked: product.isBlocked,
          stock: variant.stock,
        };
      })
    );

    if (items.some((item) => item.isBlocked)) {
      return res.redirect(
        "/cart?error=" +
          encodeURIComponent(
            "Some of your products are Un-available, Please remove it and proceed !"
          )
      );
    } else if (items.some((item) => item.stock <= 0)) {
      return res.redirect(
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
      return res.redirect(
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

    const finalPayableAmount =
      discountFinalAmount > 0 ? discountFinalAmount : finalAmount;

    if (!paymentMethod) {
      return res.redirect(
        "/orders?error=" + encodeURIComponent("Please Select a Payment Method")
      );
    }

    if (paymentMethod === "COD") {
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

      return res.render("orderSuccess", {
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
        orderId: newOrder._id,
        method: "Online",
        status: "Pending",
        amount: finalPayableAmount,
        gateway: "Razorpay",
        transactionId: razorpayOrder.id,
      });
      await newPayment.save();

      newOrder.paymentId = newPayment._id;
      await newOrder.save();

      return res.json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderId: razorpayOrder.id,
        orderDbId: newOrder._id,
      });
    }
  } catch (error) {
    console.error("Order checkout error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal sever error placing order" });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.redirect("/login");
    }
    const user = await User.findById(userId);

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderDbId,
    } = req.body;

    const paymentDoc = await Payment.findOne({ orderId: orderDbId });

    const responseSnapshot = { ...req.body };

    //Payment failure
    if (!razorpay_signature) {
      if (paymentDoc) {
        paymentDoc.status = "Failed";
        paymentDoc.paymentId = razorpay_payment_id || null;
        paymentDoc.transactionId =
          razorpay_order_id || paymentDoc.transactionId;
        paymentDoc.responseData = responseSnapshot;
        await paymentDoc.save();
      }
      await Order.findByIdAndUpdate(orderDbId, {
        paymentStatus: "Failed",
        status: "Pending",
      });
      return res.json({
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
        await paymentDoc.save();
      }
      await Order.findByIdAndUpdate(orderDbId, {
        paymentStatus: "Paid",
        status: "Placed",
      });

      // Reduce stock only after successful payment
      const order = await Order.findById(orderDbId).populate(
        "orderedItems.product"
      );
      for (const item of order.orderedItems) {
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

      return res.json({ success: true, orderId: orderDbId });
    } else {
      //Signature exists but mismatch happened
      if (paymentDoc) {
        paymentDoc.status = "Failed";
        paymentDoc.responseData = responseSnapshot;
        await paymentDoc.save();
      }
      await Order.findByIdAndUpdate(orderDbId, {
        paymentStatus: "Failed",
        status: "Pending",
      });
      return res.json({
        success: false,
        redirect: `/loadRetryPayment?orderId=${orderDbId}`,
      });
    }
  } catch (error) {
    console.error("Verification error:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal Server Error for Razorpay" });
  }
};

const loadRetryPayment = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.redirect("/login");
    }
    const user = await User.findById(userId);
    const { orderId } = req.query;
    const order = await Order.findById(orderId)
      .populate("orderedItems.product")
      .lean();
    res.render("retryPayment", {
      user,
      order,
    });
  } catch (error) {
    console.log("Retry payment page load error", error);
    return res
      .status(500)
      .json({ success: false, message: "Inrernal server error" });
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

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: razorpayOrder.id,
      orderDbId: orderId,
    });
  } catch (error) {
    console.error("Retry Payment Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal server error while retry payment.",
      });
  }
};

const orderSuccess = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.redirect("/login");
    }
    const user = await User.findById(userId);
    const orderId = req.query.orderId;

    const orders = await Order.findById(orderId).populate(
      "orderedItems.product"
    );
    res.render("orderSuccess", {
      user,
      orders,
      orderId,
    });
  } catch (error) {
    console.log("Order success page load error:", error);
  }
};

const orderHistory = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
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

    res.render("orderHistory", {
      orders: formattedOrders,
      user,
      search,
      totalItems,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.log("order history page load error:", error);
    return res.redirect("/pageNotFound");
  }
};

const orderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user || req.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

    const order = await Order.findOne({ _id: id, userId }).lean();
    if (!order) {
      return res.redirect("/myOrders");
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

    res.render("orderDetails", {
      user,
      order,
    });
  } catch (error) {
    console.log("Order details page error: ", error);
    return res.redirect("/pageNotFound");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.redirect("/login");
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

    order.status = "Cancelled";
    order.cancelReason = reason;

    order.orderedItems.forEach((item) => {
      item.itemStatus = "Cancelled";
    });

    await order.save();

    return res.json({
      success: true,
      message: "Cancellation request submitted successfully",
    });
  } catch (error) {
    console.error("Order cancelling error: ", error);
    return res.redirect("/pageNotFound");
  }
};

const cancelSingleItem = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
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
          message: "This item cannot be cancelled after shipping",
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

    item.itemStatus = "Cancelled";
    item.cancelReason = reason;

    const allCancelled = order.orderedItems.every(
      (it) => it.itemStatus === "Cancelled"
    );
    if (allCancelled) {
      order.status = "Cancelled";
      order.cancelReason = reason;
    }

    await order.save();

    return res.json({ success: true, message: `"${item.name} Cancelled"` });
  } catch (error) {
    console.log("Single item cancel error:", error);
    return res.redirect("/pageNotFound");
  }
};

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
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
    order.orderedItems.forEach((item) => {
      item.itemStatus = "Return Requested";
    });
    order.returnReason = reason;

    await order.save();

    return res
      .status(200)
      .json({ success: true, message: "Return requested successfully" });
  } catch (error) {
    console.log("Order returning error:", error);
    return res.redirect("/pageNotFound");
  }
};

const returnSingleItem = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.redirect("/login");
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
    console.log("Single item return error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Sever error while returning single item",
      });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, userId }).lean();
    if (!order) {
      return res.redirect("/myOrders");
    }

    res.setHeader(
      "Content-Disposition",
      `attachement; filename=Invoice-${order.orderId}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

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
      .text("Total", 450);

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#aaa");
    doc.moveDown(0.5);

    // Items
    doc.font("Times-Roman").fillColor("#000");
    order.orderedItems.forEach((item) => {
      const itemY = doc.y;
      const total = item.price * item.quantity;

      doc.text(`${item.name} (${item.coverType})`, 50, itemY, { width: 200 });
      doc.text(`${item.quantity}`, 300, itemY, { width: 50 });
      doc.text(`Rs: ${item.price}`, 400, itemY, { width: 80 });
      doc.text(`Rs: ${total}`, 500, itemY, { width: 100 }).moveDown(0.3);
    });

    doc.moveDown(1);

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
      .text(`Rs: ${order.totalPrice}`, 450, currenY, { align: "right" })
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
      .text(`Rs: ${order.shippingCharge || 0}`, 450, currenY, {
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
      .text(`Rs: ${order.finalAmount}`, 450, doc.y, { align: "right" })
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
    console.log("Invoice download error:", error);
    return res.redirect("/myOrders");
  }
};

module.exports = {
  loadOrderPage,
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
