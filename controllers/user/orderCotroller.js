const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const path = require('path')
const PDFDocument = require('pdfkit');
const { model } = require('mongoose');

const loadOrderPage = async (req, res) => {
    try {
        const userId = req.session.user || req.user;
        if(!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if(!user) {
            return res.redirect('/login');
        }

        const addressDocs = await Address.find({userId: user._id}).lean();
        const existingAddress = addressDocs.map(doc => doc.address ? doc.address.filter(addr => !addr.isDeleted) : []).flat();
        const allAddresses = existingAddress;
       
        const sortedAddresses = allAddresses.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        const recentAddresses = sortedAddresses.slice(0,1);
        
        const cart = await Cart.findOne({userId}).populate({
            path: 'items.productId'
        });

        if(!cart || cart.items.length === 0) {
            return res.redirect ('/cart?error='+encodeURIComponent('Cart is empty'));
        }

        let items = cart.items.map(item => {
            const product = item.productId;
            const variant = product.variants.id(item.variantId);
            const price = variant.discountPrice || variant.originalPrice;
            const image = product.images && product.images.length>0 ? product.images[0] : null;

             return {
                productId: product._id,
                variantId: variant._id,
                name: product.name,
                coverType: variant.coverType,
                quantity: item.quantity,
                price: price,
                image: image,
                totalPrice: item.quantity * price
             }
        });

        const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
        let shippingCharge = 0;
        let discount = 0;
        if((subtotal - discount)<1000){
            shippingCharge = 50;
        }
        const finalAmount = subtotal - discount + shippingCharge;

        res.render('checkout', {
            user,
            items,
            subtotal,
            discount,
            shippingCharge,
            finalAmount,
            addresses: recentAddresses,
            allAddresses,

        })
        
    } catch (error) {
        console.log('Order page load error:' ,error);
        res.redirect('/pageNotFound')
    }
}

const checkout = async (req,res) => {
    try {
        const userId = req.session.user || req.user;
        const user = await User.findById(userId);
        if(!user){
            return res.redirect('/login')
        }

        const { selectedAddressId, paymentMethod } = req.body;
        
        const cart = await Cart.findOne({userId}).populate({
            path: 'items.productId',
        })
        
         if(!cart || cart.items.length === 0) {
            return res.redirect ('/cart?error='+encodeURIComponent('Cart is empty'));
        }

        let items = cart.items.map(item => {
            const product = item.productId;
            const variant = product.variants.id(item.variantId);
            const price = variant.discountPrice || variant.originalPrice;
            const image = product.images && product.images.length > 0 ? product.images[0] : null;

             return {
                product: product._id,
                variantId: variant._id,
                name: product.name,
                coverType: variant.coverType,
                quantity: item.quantity,
                price: price,
                totalPrice: item.quantity * price,
                image: image
             }
        });

        const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
        let shippingCharge = 0;
        let discount = 0;
        if((subtotal - discount)<1000){
            shippingCharge = 50;
        }
        const finalAmount = subtotal - discount + shippingCharge;

        const addressDoc = await Address.findOne(
            { userId, 'address._id' : selectedAddressId } ,
            { 'address.$': 1 }
        ).lean();

        if(!addressDoc || !addressDoc.address[0]) {
            return res.redirect('/orders?error=' + encodeURIComponent("Invalid Address Selection"));
        }
        const selectedAddress = addressDoc.address[0];
        selectedAddress.userId = userId;

        const orders = await Order.find({ userId })
                                .sort({ createdAt: -1 })
                                .lean();

        if(!paymentMethod) {
            return res.redirect('/orders?error=' + encodeURIComponent("Please Select a Payment Method"));
        }

        if(paymentMethod === 'COD'){
            const newOrder = new Order({
            userId,
            orderedItems: items,
            totalPrice: subtotal,
            discount,
            shippingCharge,
            finalAmount,
            shippingAddress: selectedAddress,
            paymentMethod: "COD",
            paymentStatus: 'Pending',
            status: 'Pending',
            createdAt: new Date()
        });
        await newOrder.save();

        for(const item of items ) {
            await Product.updateOne(
                { _id: item.product, 'variants._id' : item.variantId },
                { $inc: { "variants.$.stock" : -item.quantity } }
            );
        }

        await Cart.updateOne({userId} , { $set: {items: [] } });

        return res.render('orderSuccess', {
            orderId: newOrder.orderId,
            user,
            orders
        });
        } else if( paymentMethod ==='Online') {
            console.log("Online Payment - We will set in Next Week")
        }
        
        
    } catch (error) {
        console.error('Order checkout error:',error);
        res.redirect('/pageNotFound');
    }
}

const orderHistory = async (req,res) => {
    try {
        const userId = req.session.user || req.user;
        const user = await User.findById(userId);
        if(!user) {
            return res.redirect('/login');
        }

        const search = req.query.search ? req.query.search.trim() : null;

        let query = { userId };

        if(search) {
            query = {
                userId,
                $or: [
                    { orderId: { $regex: `^${search}`, $options: 'i'} },
                    { status: { $regex: `^${search}`, $options: 'i' } },
                    { 'orderedItems.name': { $regex: `^${search}` ,$options: 'i'} }
                ]
            }
        }

        const orders = await Order.find( query )
                                .sort({ createdAt: -1 })
                                .lean();
        
        const formattedOrders = orders.map(order => {
            const orderStatus = [ 'Pending', 'Packed', 'Shipped', 'Out for Delivery','Delivered', 'Cancel Requested', 'Cancelled', 'Return Requested', 'Returned' ];
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
                    year: "numeric"
                })
            }
        });

        res.render('orderHistory', { 
            orders: formattedOrders,
            user,
            search
        })
        
    } catch (error) {
        console.log('order history page load error:', error);
        return res.redirect('/pageNotFound')
    }
}

const orderDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.user || req.user;
        const user = await User.findById(userId);
        if(!user) {
            return res.redirect('/login');
        }

        const order = await Order.findOne({ _id: id, userId}).lean();
        if(!order) {
            return res.redirect('/myOrders')
        }

        const orderDate = new Date(order.createdAt);
        const expectedDelivery = new Date(order.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

        const formatDate = (date) => date.toLocaleDateString('en-IN', { day: '2-digit' , month: 'short' , year: 'numeric'});

        order.orderDateFormatted = formatDate(orderDate);
        order.expectedDeliveryDateFormatted = formatDate(expectedDelivery);

        const statusStages = ['Pending', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
        order.statusIndex = statusStages.indexOf(order.status);

        order.items = order.orderedItems.map(item => ({
            ...item,
            totalPrice: item.price * item.quantity
        }) );

        order.canCancel = ['Pending', 'Packed'].includes(order.status);
        order.canReturn = order.status === 'Delivered';

        order.address = order.shippingAddress;
        order.subtotal = order.totalPrice;
        order.shippingCharge = order.shippingCharge;

        res.render('orderDetails', {
            user,
            order
        })
        
    } catch (error) {
        console.log("Order details page error: ", error);
        return res.redirect('/pageNotFound');
    }
}

const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user || req.user;
        const orderId = req.params.id;

        const order = await Order.findOne({ _id: orderId, userId });
        if(!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if(![ 'Pending', 'Packed' ].includes(order.status)) {
            return res.status(400).json({ success: false, message: "Cannot cancel the order after shipping"});
        }

        order.status = "Cancel Requested";
        order.orderedItems.forEach(item => {
            item.itemStatus = 'Cancel Requested';
        });
        
        await order.save();
        
        return res.json({ success: true, message: "Cancellation request submitted successfully"});

    } catch (error) {
        console.error("Order cancelling error: ",error);
        return res.redirect("/pageNotFound")
    }
};

const cancelSingleItem = async (req, res) => {
    try {
        const userId = req.session.user || req.user;
        const { orderId, itemId } = req.params;
console.log(`${orderId}, ${itemId}`);

        const order = await Order.findOne({ _id: orderId, userId });
        if(!order) {
            return res.status(404).json({success: false, message: "Order not found"})
        }

        const item = order.orderedItems.id(itemId);
        if(!item) {
            return res.status(404).json({success: false, message: "Item not found"})
        }

         if (!['Pending', 'Packed'].includes(item.itemStatus)) {
      return res.status(400).json({ success: false, message: "This item cannot be cancelled after shipping" });
    }

    item.itemStatus = 'Cancel Requested';

    const allCancelled = order.orderedItems.every(it => it.itemStatus === 'Cancel Requested');
    if (allCancelled) {
      order.status = 'Cancel Requested';
    }

    await order.save();

    return res.json({ success: true, message: `Cancellation requested for "${item.name}"` });

    } catch (error) {
        console.log("Single item cancel error:", error);
        return res.redirect('/pageNotFound')
    }
}

const returnOrder = async (req, res) => {
    try {
        const userId = req.session.user || req.user;
        const orderId = req.params.id;

        const order = await Order.findOne({_id: orderId, userId});
        if(!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const returnLimit = new Date(order.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);

        if(!order.status !== "Delivered") {
            return res.status(400).json({success: false, message: "Cannot return the order now"})
        }

        if(Date.now > returnLimit) {
            return res.status(400).json({success: false, message: "Return date over"})
        }

        order.status = "Return Requested";
        order.orderedItems.forEach(item => {
            item.itemStatus = "Return Requested";
        })

        await order.save();

        return res.status(200).json({ message: "Return requested successfully"});
        
    } catch (error) {
        console.log("Order returning error:" ,error);
        return res.redirect("/pageNotFound")
    }
}

const downloadInvoice = async (req, res) => {
    try {
        const userId = req.session.user || req.user;
        const { id } = req.params;

        const order= await Order.findOne({_id: id, userId }).lean();
        if(!order) {
            return res.redirect('/myOrders');
        }

        res.setHeader('Content-Disposition' , `attachement; filename=Invoice-${order.orderId}.pdf`);
        res.setHeader('Content-Type' , 'application/pdf');

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        doc
        .fillColor('#c93f1c')
        .fontSize(25)
        .font('Times-BoldItalic')
        .text('INVOICE', { align: 'center' , underline: true});
        doc.moveDown(1.5);

        doc
      .fontSize(14)
      .fillColor('#34495e')
      .font('Times-Bold')
      .text('Order Details:', { underline: true })
      .moveDown(0.5);

        doc.fontSize(12).fillColor('#091fe3')
                .font('Times-Italic')
                .text(`Order ID: ${order.orderId}`)
                .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`)
                .text(`Expected Delivery: ${new Date(order.createdAt.getTime()  + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}`)
                // .text(`Invoice date: ${new Date.now().getTime().toLocaleDateString('en-IN')}`, 350, doc.y, { width: 100, align: 'right' })

        doc.fontSize(12).fillColor("#f90000ff").text(`Order Status: ${order.status}`)
              .moveDown(1);

        doc
            .fontSize(14)
            .fillColor('#34495e')
            .font('Times-Bold')
            .text('Customer Information:', { underline: true })
            .moveDown(0.5);

        doc
            .fontSize(12)
            .fillColor('#091fe3')
            .font('Times-Italic')
            .text(`Customer Name: ${order.shippingAddress.name}`)
            .text(`Phone: ${order.shippingAddress.phone}, ${order.shippingAddress.altPhone}`)
            .text(`Address: ${order.shippingAddress.streetAddress}, ${order.shippingAddress.city} 
                ${order.shippingAddress.state}, ${order.shippingAddress.pinCode}`)
            .moveDown(1);

        doc
            .font('Times-Bold')
            .fillColor('#34495e')
            .fontSize(14)
            .text('Ordered Items: ', {underline: true})
            .moveDown(0.5);


       // Table Header
    doc
      .fontSize(12)
      .fillColor('#2c3e50')
      .font('Times-Bold')
      .text('Item', 50, doc.y, { continued: true })
      .text('Qty', 280, doc.y, { continued: true })
      .text('Price', 350, doc.y, { continued: true })
      .text('Total', 450);

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#aaa');
    doc.moveDown(0.5);

    // Items
    doc.font('Times-Roman').fillColor('#000');
    order.orderedItems.forEach(item => {
        const itemY = doc.y;
        const total = item.price * item.quantity;

   doc.text(`${item.name} (${item.coverType})`, 50, itemY, { width: 200 });
  doc.text(`${item.quantity}`, 300, itemY, { width: 50 });
  doc.text(`Rs: ${item.price}`, 400, itemY, { width: 80 });
  doc.text(`Rs: ${total}`, 500, itemY, { width: 100 })
        .moveDown(0.3);
    });

    doc.moveDown(1);

    // === Totals ===
    let currenY = doc.y;
    doc
  .fontSize(12)
  .font('Times-Bold')
  .fillColor('#2c3e50')
  .text('Subtotal:', 350, currenY, { continued: true, width: 100, align: 'left' })
  .font('Times-Roman')
  .fillColor('#000')
  .text(`Rs: ${order.totalPrice}`, 450, currenY, { align: 'right' })
  .moveDown(0.3);

  currenY = doc.y;
doc
  .font('Times-Bold')
  .fillColor('#2c3e50')
  .text('Shipping Charge:', 350, currenY, { continued: true, width: 100, align: 'left' })
  .font('Times-Roman')
  .fillColor('#000')
  .text(`Rs: ${order.shippingCharge || 0}`, 450, currenY, { align: 'right' })
  .moveDown(0.3);

  currenY = doc.y;
doc
  .font('Times-Bold')
  .fillColor('#2c3e50')
  .text('Discount:', 350, currenY, { continued: true, width: 100, align: 'left' })
  .font('Times-Roman')
  .fillColor('#fb0000ff')
  .text(`- Rs: ${order.discount || 0}`, 450, currenY, { align: 'right' })
  .moveDown(0.3);

doc
  .moveTo(350, doc.y)
  .lineTo(550, doc.y)
  .stroke('#aaa')
  .moveDown(0.3);

doc
  .fontSize(14)
  .font('Times-Bold')
  .fillColor('#2c3e50')
  .text('Total Amount:', 350, doc.y, { continued: true, width: 100, align: 'left' })
  .font('Times-Bold')
  .fillColor('#000')
  .text(`Rs: ${order.finalAmount}`, 450, doc.y, { align: 'right' })
  .moveDown(2);

    // === Footer ===
    doc
      .fontSize(10)
      .fillColor('#c93f1c')
      .font('Times-Italic')
      .text('Thank you for shopping with Kitab4U!', { align: 'center' })
      .text('For queries, contact: support@kitab4u.com', { align: 'center' });

    doc.end();

    } catch (error) {
        console.log("Invoice download error:", error);
        return res.redirect('/myOrders')
    }
}

module.exports = {
    loadOrderPage,
    checkout,
    orderHistory,
    orderDetails,
    cancelOrder,
    cancelSingleItem,
    returnOrder,
    downloadInvoice

}