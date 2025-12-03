const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const { default: mongoose, model } = require("mongoose");
const calculateDiscountedPrice  = require('../../helpers/offerPriceCalculator');

const loadCart = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }

    const productId = req.query.id;
    const product = productId ? await Product.findById(productId) : null;

    const cart = await Cart.findOne({ userId }).populate({
      path:'items.productId',
      populate:{
        path:'categoryId',
        model:'Category',
        match: {isListed: true}
      }
    }).lean();

    let cartItems =[];
    let subtotal = 0;
    if (cart && cart.items.length > 0) {
      cartItems = cart.items.filter(
        item => item.productId && item.productId.categoryId
      );
      for( let item of cartItems) {
        const variant = item.productId.variants.find(v => v._id.equals(item.variantId));

        const pricing = await calculateDiscountedPrice({
          _id: item.productId._id,
          discountPrice: variant.discountPrice,
          originalPrice: variant.originalPrice,
          categoryId: item.productId.categoryId
        });
        item.finalPrice = Number(pricing.finalPrice);
        item.totalPrice = item.finalPrice * item.quantity;
        subtotal += item.totalPrice; 
      }
      // subtotal = cartItems.reduce((total, item) => total + item.totalPrice , 0);
    }

    res.render("cart", {
      user,
      product,
      cartItems,
      subtotal,
      error: req.query.error || null,
    });
  } catch (error) {
    const err = new Error("Cart page loading server error");
    return next (err);
  }
};

const addTocart = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    if (!userId) {
      return res.redirect(
        "/login?error=" +
          encodeURIComponent("Please login to add products to cart")
      );
    }

    const productId = req.body.productId;
    const variantId = req.body.variantId;

    const product = await Product.findOne({
      _id: productId,
      "variants._id": variantId,
    }).populate("categoryId");

    if (!product) {
      return res.redirect(
        "/cart?error=" + encodeURIComponent("Product not found")
      );
    }

    const variant = product.variants.id(variantId);

    if (!variant) {
      return res.redirect(
        "/cart?error=" + encodeURIComponent("Variant not found")
      );
    }

    if(variant.stock===0) {
        return res.redirect(
        "/cart?error=" + encodeURIComponent("Out of stock")
      );
    }

    if (
      product.isBlocked ||
      !product.categoryId ||
      !product.categoryId.isListed
    ) {
      console.log("if product/category blocked");
      return res.redirect(
        "/cart?error=" + encodeURIComponent("This product is not available")
      );
    }

    const variantPrice = variant.discountPrice || variant.originalPrice;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

  let cartItem = cart.items.find(item => 
  item.productId?.toString() === productId.toString() &&
  item.variantId?.toString() === variantId.toString()
);

    if (cartItem) {
      if (cartItem.quantity < variant.stock && cartItem.quantity < 5) {
        cartItem.quantity += 1;
        cartItem.totalPrice = cartItem.quantity * cartItem.price;
      } else {
        return res.redirect(
          "/cart?error=" + encodeURIComponent("Maximum quantity reached")
        );
      }
    } else {
      cart.items.push({
        productId: product._id,
        variantId: variant._id,
        quantity: 1,
        price: variantPrice,
        totalPrice: variantPrice,
      });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        (item) =>
          item.productId.toString() !== productId.toString() ||
          item.variantId?.toString() !== variantId.toString()
      );
      await wishlist.save();
    }

    await cart.save();
    return res.redirect(
      "/cart?success=" + encodeURIComponent("Product added to cart")
    );
  } catch (error) {
    const err = new Error("Add to cart internal server error");
    return next (err);
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const { productId, variantId } = req.body;

          await Cart.findOneAndUpdate(
          { userId },
          { $pull: { items: { productId: productId, variantId: variantId } } },
          { new: true }
    );
    return res.json({ success: true });

  } catch (error) {
    const err = new Error("Cart item removig server error");
    return next(err);
  }
};

const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.user || req.user;
    const { productId, action, variantId } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    
    const cartItem = cart.items.find(
      item =>
        item.productId?._id?.toString() === productId.toString() &&
        item.variantId?.toString() === variantId.toString()
    );

      if (!cartItem)
      return res.redirect(
        "/cart?error=" + encodeURIComponent("Item not in cart")
      );

    if(cartItem.productId.isBlocked){
      return res.redirect('/cart?error='+encodeURIComponent("Item is Unlisted \nRemove it from the cart"))
    }

  const variant = cartItem.productId.variants.find(
    v => v._id.toString() === cartItem.variantId.toString()
  );

    if (action === "inc") {
      if (cartItem.quantity < variant.stock && cartItem.quantity < 5) {
        cartItem.quantity += 1;
      } else {
        return res.redirect(
          "/cart?error=" + encodeURIComponent("Maximum limit/stock reached")
        );
      }
    } else if (action === "dec") {
      if (cartItem.quantity > 1) {
        cartItem.quantity -= 1;
      }
    }
    cartItem.totalPrice = cartItem.quantity * cartItem.price;
    await cart.save();
    res.redirect("/cart");
  } catch (error) {
    const err = new Error("Quantity updating server error")
    err.redirect = "/cart?error=" + encodeURIComponent("Unable to update quantity");
    return next (err)
  }
};

module.exports = {
  loadCart,
  addTocart,
  removeFromCart,
  updateQuantity,
};
