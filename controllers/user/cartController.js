const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const { default: mongoose } = require("mongoose");

const loadCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }

    const productId = req.query.id;
    const product = productId ? await Product.findById(productId) : null;

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    let subtotal = 0;
    if (cart && cart.items.length > 0) {
      subtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    }

    res.render("cart", {
      user,
      product,
      cartItems: cart ? cart.items : [],
      subtotal,
      error: req.query.error || null,
    });
  } catch (error) {
    console.log("Cart page load error:", error);
    res.redirect("/pageNotFound");
  }
};

const addTocart = async (req, res) => {
  try {
    const userId = req.session.user;
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
      console.log("if product blocked");
      return res.redirect(
        "/cart?error=" + encodeURIComponent("This product is not available")
      );
    }

    const variantPrice = variant.discountPrice || variant.originalPrice;

    console.log("VariantId price:", variantPrice);

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

  let cartItem = cart.items.find(item => 
  item.productId?.toString() === productId.toString() &&
  item.variantId?.toString() === variantId.toString()
);
console.log("cart items:", cartItem);

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
      wishlist.items = wishlist.items.filter(
        (item) =>
          item.productId.toString() == productId.toString() &&
          item.variantId?.toString() === variantId.toString()
      );
      await wishlist.save();
    }

    await cart.save();
    return res.redirect(
      "/cart?success=" + encodeURIComponent("Product added to cart")
    );
  } catch (error) {
    console.log("Add to cart error:", error);
    res.redirect("/pageNotFound");
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, variantId } = req.body;

  await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId: productId, variantId: variantId } } },
      { new: true }
    );
    return res.json({ success: true });
  } catch (error) {
    console.log("cart item removig error:", error);
    res.redirect("/pageNotFound");
  }
};

const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
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
    console.log("Quantity updating error:", error);
    res.redirect(
      "/cart?error=" + encodeURIComponent("Unable to update quantity")
    );
  }
};

module.exports = {
  loadCart,
  addTocart,
  removeFromCart,
  updateQuantity,
};
