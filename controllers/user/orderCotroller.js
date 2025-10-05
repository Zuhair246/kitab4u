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
        const { selectedAddressId } = req.body;
        console.log(`selectedAddressId: ${selectedAddressId}`);
        

        const userId = req.session.user || req.user;
        const user = await User.findById(userId);
        if(!user){
            return res.redirect('/login')
        }

        const cart = await Cart.findOne({userId}).populate({
            path: 'items.productId'
        })
        
         if(!cart || cart.items.length === 0) {
            return res.redirect ('/cart?error='+encodeURIComponent('Cart is empty'));
        }

        let items = cart.items.map(item => {
            const product = item.productId;
            const variant = product.variants.id(item.variantId);
            const price = variant.discountPrice || variant.originalPrice;

             return {
                productId: product._id,
                variantId: variant._id,
                name: product.name,
                coverType: variant.coverType,
                quantity: item.quantity,
                price: price,
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
        
    } catch (error) {
        console.error('Order checkout error:',error)
    }
}

module.exports = {
    loadOrderPage,
    checkout
}