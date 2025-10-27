const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');

const loadWishlist = async (req,res)=>{
    try {
        const userId = req.session.user || req.user;
        if(!userId){
            return res.redirect('/login')
        }
        const user = await User.findById(userId);
        if(!user) {
            return res.redirect('/login');
        }

        const productId = req.query.id;
        const product = productId? await Product.findById(productId) : null;

        const wishlist = await Wishlist.findOne({userId}).populate({
            path: 'products.productId',
            populate: {
                path: 'categoryId',
                model: 'Category',
                match: {isListed: true}
            }
        });

        const wishlistItems = [];
        if(wishlist && wishlist.products.length > 0){
            wishlistItems = Wishlist.products.filter( 
                item => item.productId && item.productId.categoryId
            )
        }
        console.log(`filered wishlist: ${wishlistItems}`);
        
        res.render('wishlist', {
            user,
            product,
            wishlistItems
        })
        
    } catch (error) {
        console.log('Wishlist page load error:', error);
        return res.status(500).json({success: false, message:"Internal sever error from wishlist"})
            }
}


module.exports = {
    loadWishlist
}