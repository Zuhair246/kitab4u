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

    // Category & Product offers
    const findCategory = product.categoryId;
    const categoryOffer = (findCategory && findCategory.categoryOffer) || 0;
    const productOffer = product.productOffer || 0;
    const totalOffer = categoryOffer + productOffer;

    // Stock calculation
    const quantity = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);

    // Similar products
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

const filterProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const category = req.query.category;
    const priceRange = req.query.priceRange;
    const findCategory = category ? await Category.findOne({ _id: category }) : null;

    const query = {
      isBlocked: false,
      'variants.stock': { $gt: 0 },
    };

    if (findCategory) {
      query.categoryId = findCategory._id;
    }

    // ✅ Price filter logic
    if (priceRange) {
      let minPrice = 0, maxPrice = Infinity;

      switch (priceRange) {
        case "100-200":
          minPrice = 100; maxPrice = 200;
          break;
        case "200-400":
          minPrice = 200; maxPrice = 400;
          break;
        case "400-700":
          minPrice = 400; maxPrice = 700;
          break;
        case "700-1000":
          minPrice = 700; maxPrice = 1000;
          break;
        case "1000+":
          minPrice = 1000; maxPrice = Infinity;
          break;
      }

      query["variants.discountPrice"] = { $gte: minPrice };
      if (maxPrice !== Infinity) {
        query["variants.discountPrice"].$lte = maxPrice;
      }
    }

    let findProducts = await Product.find(query).lean();
    findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const categories = await Category.find({ isListed: true });

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;

    let totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    let userData = null;
    if (user) {
      userData = await User.findOne({ _id: user });
      if (userData) {
        const searchEntry = {
          category: findCategory ? findCategory._id : null,
          priceRange: priceRange || null,
          searchedOn: new Date(),
        };
        userData.searchHistory.push(searchEntry);
        await userData.save();
      }
    }

    req.session.filteredProducts = currentProduct;

    res.render("shop", {
      user: userData,
      books: currentProduct,
      category: categories,
      totalPages,
      currentPage,
      selectedCategory: category || null,
      selectedPriceRange: priceRange || null,
    });

  } catch (error) {
    console.log("Product filtering error:", error);
    res.redirect("/pageNotFound");
  }
};



module.exports = {
  productDetails,
  loadSearchResults,
  filterProducts
};
