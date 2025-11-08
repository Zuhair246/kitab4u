const ProductOffer = require('../models/productOfferSchema');
const CategoryOffer = require('../models/categoryOfferSchema');

const calculateDiscountedPrice = async ( product ) => {
    const currentPrice = product.discountPrice ;
    let maxDiscount = 0 ;

    const productOffer = await ProductOffer.findOne({ productId: product._id, isActive: true });
    if(productOffer) maxDiscount = Math.max(maxDiscount, productOffer.discountPercentage);

    const categoryOffer = await CategoryOffer.findOne({ categoryId: product.categoryId, isActive: true }) ;
    if(categoryOffer) maxDiscount = Math.max(maxDiscount, categoryOffer.discountPercentage);

    const discountAmount = (currentPrice * maxDiscount) / 100;
    const finalPrice = Math.floor(currentPrice - discountAmount);

    return {
    originalPrice: product.originalPrice ||0,
    discountPrice: currentPrice,
    discountPercentage: maxDiscount,
    finalPrice
}
}

module.exports = calculateDiscountedPrice;
