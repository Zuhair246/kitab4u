const Product = require("../models/productSchema");

const checkProductAvailability = async (req, res, next) => {
  try {
    const productId = req.params.id || req.body.productId;

    if (!productId) {
      return res.redirect("/shop");
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/shop");
    }

    if (product.isBlocked) {
      return res.redirect("/shop");
    }

    const hasStock = product.variants.some((variant) => variant.stock > 0);

    if (!hasStock) {
      return res.redirect("/shop");
    }

    next();
  } catch (error) {
    console.error("Product availability check failed:", error);
    return res.redirect("/shop");
  }
};

module.exports = checkProductAvailability;
