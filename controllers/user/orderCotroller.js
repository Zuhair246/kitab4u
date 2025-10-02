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

        const addressDocs = await Address.find({userId: user._id})
        .sort({createdAt: -1})
        .limit(2)
        .lean();

        const addresses = addressDocs.reduce((acc, doc) => {
            if(Array.isArray(doc.address)) {
                acc.push(...doc.address)
            }
            return acc;
        },[]);
        console.log(addresses);
        const sortedAddresses = addresses.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        const recentAddresses = sortedAddresses.slice(0,2);
        
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
        
        const discount = 0;
        const shippingCharge = 0;
        const finalAmount = subtotal - discount + shippingCharge;

        res.render('checkout', {
            user,
            items,
            subtotal,
            discount,
            shippingCharge,
            finalAmount,
            addresses: recentAddresses,

        })
        
    } catch (error) {
        console.log('Order page load error:' ,error);
        res.redirect('/pageNotFound')
    }
}


module.exports = {
    loadOrderPage
}