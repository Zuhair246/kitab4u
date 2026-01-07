import Product from '../../models/productSchema.js';
import ProductOffer from '../../models/productOfferSchema.js';
import { statusCodes } from '../../helpers/statusCodes.js';
import { name } from 'ejs';
const { BAD_REQUEST, OK, NOT_FOUND, SERVER_ERROR } = statusCodes;

const loadProductOffers = async (req, res) => {
    try {
        const products = await Product.find().sort({name: 1}).lean();
        const offers = await ProductOffer.find()
                                                            .populate('productId')
                                                            .lean();

        const currentPage = req.query.page ? Number(req.query.page) : 1;
        const totalPages = 1;
        

        res.render("productOffer", {
            products,
            offers,
            success: req.query.success,
            error: req.query.error,
            currentPage,
            totalPages
        });
    } catch (error) {
        const err = new Error("Product offer listing server error");
        throw err;
    }
}

const addProductOffer = async (req, res) => {
    try {
        const { productId, discountPercentage, startDate, endDate } = req.body;

        if ( !productId || !discountPercentage || !startDate || !endDate ) {
            return res.status(BAD_REQUEST).json({ success: false, message: "Fill all the fields"});
        }

        const product = await Product.findById(productId);
        if(!product) {
            return res.status(BAD_REQUEST).json({ success: false, message: "Product not found"})
        }

        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);

        const startDay = new Date(startDate);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if(endDay && endDay < today || startDay && startDay < today) {
            return res.status(BAD_REQUEST).json({ success: false, message: "Start date and End date should not be past"});
        }

        if(startDay &&  endDay && endDay < startDay) {
            return res.status(BAD_REQUEST).json({ success: false, message: "End date should not be before start date"})
        }

        await ProductOffer.deleteMany({ productId });

        await ProductOffer.create({
            productId,
            discountPercentage,
            startDate: startDay,
            endDate: endDay,
            isActive: true
        });

        return res.status(200).json({ success: true, message: "Product offer added", redirect:'/admin/productOffers'});
    } catch (error) {
        console.error(error);
        return res.status(SERVER_ERROR).json({
        success: false,
        message: "Add product offer internal server error"
        });
  }
}

const editProductOffer = async (req, res) => {
    try {
        const { offerId, discountPercentage, startDate, endDate } = req.body;
        
        if(!offerId){
            return res.status(BAD_REQUEST).json({ success: false, message: "Offer not found!"});
        }
        if(!discountPercentage || !startDate || !endDate){
            return res.status(BAD_REQUEST).json({ success: false, message: "Fill all the fields"});
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDay = new Date(startDate);

        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);

        if(startDay && startDay < today || endDay && endDay < today) {
            return res.status(BAD_REQUEST).json({ success: false, message: "Start date and End date should not be past"})
        }

        if(startDay && endDay && endDay < startDay) {
            return res.status(BAD_REQUEST).json({ success: false, message: "End date should not be before Start date"})
        }

        await ProductOffer.findByIdAndUpdate(offerId, {
            discountPercentage,
            startDate: startDay,
            endDate: endDay,
        });

        return res.status(OK).json({ success: true, message: "Product Offer updated"});
    } catch (error) {
        console.error(error);
        return res.status(SERVER_ERROR).json({
        success: false,
        message: "Edit product offer internal server error"
        });
    }
}

const activateProductOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        if(!offerId){
            return res.status(BAD_REQUEST).json({ success: false, message: "Offer not found!"})
        }

        await ProductOffer.findByIdAndUpdate(offerId, { isActive: true });
        
        return res.status(OK).json({ success: true, message: "Offer Activated"})
    } catch (error) {
        console.error(error);
        return res.status(SERVER_ERROR).json({
        success: false,
        message: "Activate product offer internal server error"
        });
    }
}

const deactivateProductOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        if(!offerId){
            return res.status(BAD_REQUEST).json({ success: false, message: "Offer not found!"})
        }
        
        await ProductOffer.findByIdAndUpdate(offerId, { isActive: false });

        return res.status(OK).json({ success: true, message: "Offer Deactivated"});
    } catch (error) {
        console.error(error);
        return res.status(SERVER_ERROR).json({
        success: false,
        message: "Deactivate product offer internal server error"
        });
    }
}

export default {
    loadProductOffers,
    addProductOffer,
    editProductOffer,
    activateProductOffer,
    deactivateProductOffer
}