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
        if(userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if(!user) {
            return res.redirect('/login');
        }

        const address = await Address.find({userId})

        const cart = await Cart.findOne({userId}).populate({
            path: 'itmes.productId',
            model: "Product"
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

        const subtotal = items.reduce((sum, item) => sum + it.totalPrice, 0);
        
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
            addresses: address,

        })
        
    } catch (error) {
        console.log('Order page load error:' ,error);
        res.redirect('/pageNotFound')
    }
}


module.exports = {
    loadOrderPage
}