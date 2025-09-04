const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    const productId = req.query.id;
    const product = await Product.findById(productId)
      .populate('categoryId')
      .lean();

    if (!product) {
      return res.redirect('/pageNotFound');
    }

   
    const findCategory = product.categoryId;
    const categoryOffer = (findCategory && findCategory.categoryOffer) || 0;
    const productOffer = product.productOffer || 0;
    const totalOffer = categoryOffer + productOffer;

  
    const quantity = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);


    const similarProducts = await Product.find({
      _id: { $ne: productId },
      categoryId: product.categoryId,
      isBlocked: false,
      'variants.stock': { $gt: 0 }
    })
      .limit(4)
      .lean();

    res.render('productDetails', {
      user: userData,
      product,
      quantity,
      totalOffer,
      category: findCategory,
      similarProducts
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
      'variants.stock': { $gt: 0 },
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
