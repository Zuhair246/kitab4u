import Product from '../../models/productSchema.js';
import Category from '../../models/categorySchema.js';
import User from '../../models/userSchema.js';
import Wishlist from '../../models/wishlistSchema.js';
import {calculateDiscountedPrice} from '../../helpers/offerPriceCalculator.js';

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user || req.user ;
    const userData = await User.findById(userId);

    const productId = req.query.id;

    const product = await Product.findById(productId)
      .populate('categoryId')
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found!" })
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

     return res.status(200).render('productDetails', {
      user: userData,
      product,
      quantity,
      category,
      similarProducts,
      wishlistItems
    });
  } catch (error) {
    const err = new Error("Product details server error");
    return next (err);
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

     return res.status(200).render("shop", {
      user: userData,
      books: products,
      category: categories.map(c => ({ _id: c._id, name: c.name })),
      totalProducts: totalProductsCount,
      currentPage: page,
      totalPages,
      search: query
    });
  } catch (error) {
    const err = new Error("Shop page searching server error");
    return next (err);
  }
};

const loadAboutPage = async (req, res) => {
  try {
      return res.status(200).render('about');
  } catch (error) {
    const err = new Error("About page loading error");
    throw err;
  }
}

const loadContactPage = async (req, res) => {
  try {
    return res.status(200).render('contactUs')
  } catch (error) {
    const err = new Error("Conatact us page  load error");
    throw err;
  }
}

export default {
  productDetails,
  loadSearchResults,
  loadAboutPage,
  loadContactPage
};
