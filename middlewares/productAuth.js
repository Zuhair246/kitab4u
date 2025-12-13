import Product from '../models/productSchema.js';

export const checkProductAvailability = async (req, res, next) => {
  try {
    const productId = req.params?.id || req.body?.productId || req.query?.id;

    if (!productId) {
      return res.redirect("/shop");
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/shop");
    }

    if (product.isBlocked) {
      return res.redirect("/shop?error="+ encodeURIComponent("Product has been Unlisted by the admin"));
    } 

    next();
  } catch (error) {
    console.error("Product availability check failed:", error);
    return res.redirect("/shop");
  }
};
