const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const { path } = require('../../app');
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
            return res.redirect('/order?error=' + encodeURIComponent("Invalid Address Selection"));
        }
        const selectedAddress = addressDoc.address[0];
        selectedAddress.userId = userId;

        if(!paymentMethod) {
            return res.redirect('/order?error=' + encodeURIComponent("Please Select a Payment Method"));
        }

        if(paymentMethod === 'COD'){
            const newOrder = new Order({
            orderedItems: items,
            totalPrice: subtotal,
            discount,
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
            user
        });
        } else if( paymentMethod ==='Online') {
            console.log("Online Payment - We will set in Next Week")
        }
        
        
    } catch (error) {
        console.error('Order checkout error:',error);
        res.redirect('/pageNotFound');
    }
}

module.exports = {
    loadOrderPage,
    checkout
}