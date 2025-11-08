const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Wishlist = require ('../../models/wishlistSchema')
const calculateDiscountedPrice = require('../../helpers/offerPriceCalculator');

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user || req.user ;
    const userData = await User.findById(userId);

    const productId = req.query.id;

    const product = await Product.findById(productId)
      .populate('categoryId')
      .lean();

    if (!product) {
      return res.redirect('/pageNotFound');
    }
   
    const category = product.categoryId;

    if(product.variants && product.variants.length >0){
    for(let variant of product.variants) {
      const offer = await calculateDiscountedPrice({
        _id: product._id,
        discountPrice: variant.discountPrice,
        originalPrice: variant.originalPrice,
        categoryId: product.categoryId
      });
      variant.finalPrice = offer.finalPrice ?? variant.discountPrice;
      variant.discountPercentage = offer.discountPercentage ?? 0;
    }
  }

    const quantity = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);

    const similarProducts = await Product.find({
      _id: { $ne: productId },
      categoryId: product.categoryId,
      isBlocked: false,
    })
      .limit(4)
      .lean();

      for(let book of similarProducts) {
        for(let variant of book.variants) {
          const offer = await calculateDiscountedPrice({
            _id: book._id,
           discountPrice: variant.discountPrice,
            originalPrice: variant.originalPrice,
            categoryId: book.categoryId
          });
          variant.offerFinalPrice = offer.finalPrice || null;
          variant.offerDiscountPercentage = offer.discountPercentage;
        }
      }

    const wishlist = await Wishlist.findOne({ userId });
    const wishlistItems = wishlist ? wishlist.products.map(p => p.productId.toString()) : [];

    res.render('productDetails', {
      user: userData,
      product,
      quantity,
      category,
      similarProducts,
      wishlistItems
    });
  } catch (error) {
    console.log("Product Detail Error:", error);
    res.redirect('/pageNotFound');
  }
};

const loadSearchResults = async (req, res) => {
  try {
    const query = req.query.q?.trim() || "";
    const user = req.session.user;
    const userData = user ? await User.findById(user) : null;

    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map(c => c._id);

    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    
    const searchCondition = {
      isBlocked: false,
      categoryId: { $in: categoryIds },
      $or: [
        { name: { $regex: query, $options: "i" } },
        { author: { $regex: query, $options: "i" } }
      ]
    };

    const products = await Product.find(searchCondition)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalProductsCount = await Product.countDocuments(searchCondition);
    const totalPages = Math.ceil(totalProductsCount / limit);

    res.render("shop", {
      user: userData,
      books: products,
      category: categories.map(c => ({ _id: c._id, name: c.name })),
      totalProducts: totalProductsCount,
      currentPage: page,
      totalPages,
      search: query
    });
  } catch (error) {
    console.log("Search error:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  productDetails,
  loadSearchResults,
};
