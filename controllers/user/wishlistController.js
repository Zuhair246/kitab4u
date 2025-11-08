const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');
const flash = require('connect-flash');
const { options } = require('pdfkit');
const calculateDiscountedPrice = require('../../helpers/offerPriceCalculator');

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

        const page = parseInt(req.query.page) || 1;
        const limit = 8;

        const search = req.query.search ? req.query.search.trim() : null;
        const filter = req.query.filter || null;
        
        const wishlist = await Wishlist.findOne({userId}).populate({
            path: 'products.productId',
            populate: {
                path: 'categoryId',
                model: 'Category',
                match: {isListed: true}
            }
        })
        
        let wishlistItems = [];
        if(wishlist && wishlist.products.length > 0){
            
            wishlist.products.sort( (a , b) => new Date(b.addedOn) - new Date(a.addedOn) );
            
            wishlistItems = await Promise.all(
                wishlist.products.filter( 
                         item => item.productId && item.productId.categoryId
            ).map(async item => {
                const variant = item.productId.variants.id(item.variantId);

                const offer = await calculateDiscountedPrice({
                    _id: item.productId._id,
                    originalPrice: variant.originalPrice,
                    categoryId: item.productId.categoryId
                });
                return {
                    _id: item.productId._id,                     
                    variantId: item.variantId,
                    name: item.productId.name,
                    author: item.productId.author,
                    image: item.productId.images[0],
                    originalPrice: variant.originalPrice,
                    discountPrice: offer.finalPrice,
                    stock: variant.stock
            }
            })
        );
            

            if(search) {
                wishlistItems = wishlistItems.filter( item => 
                    item.name.toLowerCase().includes(search.toLowerCase())
                )
            }
    
            switch(filter) {
                case 'inStock' :
                    wishlistItems = wishlistItems.filter(item => item.stock > 0);
                    break;
                case 'priceLow' :
                    wishlistItems.sort((a,b) => a.discountPrice - b.discountPrice);
                    break;
                case 'priceHigh' : 
                    wishlistItems.sort((a,b) => b.discountPrice - a.discountPrice);
                    break;
                case 'nameAZ' :
                    wishlistItems.sort((a,b) => a.name.localeCompare(b.name));
                    break;
                case 'nameZA' :
                    wishlistItems.sort((a,b) => b.name.localeCompare(a.name));
                    break;
            }
        }

        const totalItems = wishlistItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedItems = wishlistItems.slice((page - 1) * limit, page * limit);
        
        res.render('wishlist', {
            user,
            wishlistItems: paginatedItems,
            search,
            totalItems,
            totalPages,
            currentPage: page
        });
        
    } catch (error) {
        console.log('Wishlist page load error:', error);
        return res.status(500).redirect('/pageNotFound')
            }
}

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user || req.user;
        if(!userId) {
             req.flash('error','Please login to add products to Wishlist');
             return res.redirect('/login');
        }
        const {productId, variantId} = req.body

        const product = await Product.findOne({
            _id: productId,
            'variants._id' : variantId,
        }).populate('categoryId');

        if(!product) {
           return res.status(400).json({type: 'error', message: "Product  not found"})
        }

        const variant = product.variants.id(variantId);

        if(!variant) {
            res.status(400).json({ type:'error', message: 'Variant not found'})
        }

        if(
            product.isBlocked ||
            !product.categoryId ||
            !product.categoryId.isListed
        ){
            res.status(400).json({ type:'error', message: "This product is not available"});
        }

        const variantPrice = variant.discountPrice || variant.originalPrice;

        let wishlist = await Wishlist.findOne({userId});
        if(!wishlist){
            wishlist = new Wishlist({ userId, items: [] });
        }

        let wishlistItem = wishlist.products.find( item => 
            item.productId?.toString() === productId.toString() &&
            item.variantId?.toString() === variantId.toString()
        )

        if(wishlistItem) {
            wishlist.products.pull(wishlistItem);
        }else {
            wishlist.products.push({
                productId: product._id,
                variantId: variant._id,
                price: variantPrice
            })
        }

        await wishlist.save()
        console.log(`${product} added to wishlist`);
        const previousPage = req.get('Referer') || '/';
        return res.redirect(previousPage);

    } catch (error) {
        console.log('Add to wishlist error:', error);
        return res.status(500).json({success: false, message: "Internal server error in addToWishlist"})
    }
}

const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user || req.user;
        const {productId, variantId} = req.body;

        await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId: productId, variantId: variantId } } },
            {new: true}
        )
        return res.json({ success: true});
        
    } catch (error) {
        console.log("Remove wishlist item error");
        res.status(500).json({ success: false, message: "Internal sever error in remove wishlist item."})
    }
}

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist
}