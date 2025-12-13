import ProductOffer from '../models/productOfferSchema.js';
import CategoryOffer from '../models/categoryOfferSchema.js';

export const calculateDiscountedPrice = async ( product ) => {
    if (!product?._id) return null;

    const currentPrice = product.discountPrice ?? product.originalPrice ?? 0;
    let maxDiscount = 0 ;
    const today = new Date();

    const productOfferQuery = await ProductOffer.findOne({ productId: product._id, isActive: true, endDate: {$gte: today}, startDate: {$lte: today} });
    
    const categoryOfferQuery = await CategoryOffer.findOne({ categoryId: product.categoryId, isActive: true, endDate: {$gte: today}, startDate: {$lte: today} }) ;

    const [productOffer, categoryOffer] = await Promise.all([
        productOfferQuery,
        categoryOfferQuery
        ]);

    if(productOffer) maxDiscount = Math.max(maxDiscount, productOffer.discountPercentage);

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
