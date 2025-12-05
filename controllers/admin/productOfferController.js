const Product = require('../../models/productSchema');
const ProductOffer = require('../../models/productOfferSchema');
const { BAD_REQUEST, OK, NOT_FOUND } = require('../../helpers/statusCodes')

const loadProductOffers = async (req, res) => {
    try {
        const products = await Product.find().lean();
        const offers = await ProductOffer.find()
                                                            .populate('productId')
                                                            .lean();

        // const productData = products.map(pro => {
        //     const offer = offers.find(ofr => ofr.productId.toString() === pro._id.toString());
        //     return {
        //         ...pro,
        //         offer: offer || null
        //     };
        // });
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

        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999)

        const startDay = new Date(startDate);
        startDay.setHours(0, 0, 0, 0)

        await ProductOffer.deleteMany({ productId });

        await ProductOffer.create({
            productId,
            discountPercentage,
            startDate: startDay,
            endDate: endDay,
            isActive: true
        });

        return res.redirect("/admin/productOffers?success=Product offer added");
    } catch (error) {
        const err = new Error("Add product offer server error");
        err.redirect = "/admin/productOffers?error=Server error";
        throw err;
    }
}

const editProductOffer = async (req, res) => {
    try {
        const { offerId, discountPercentage, startDate, endDate } = req.body;
        console.log('Loading edit for offer:', offerId);
        
        if(!offerId){
            return res.status(BAD_REQUEST).json({ success: false, message: "Offer not found!"});
        }
        if(!discountPercentage || !startDate || !endDate){
            return res.status(BAD_REQUEST).json({ success: false, message: "Fill all the fields"});
        }

        const startDay = new Date(startDate);
        startDay.setHours(0, 0, 0, 0);

        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);

        await ProductOffer.findByIdAndUpdate(offerId, {
            discountPercentage,
            startDate: startDay,
            endDate: endDay,
        });

        return res.status(OK).json({ success: true, message: "Offer updated"});
    } catch (error) {
        const err = new Error("Edit product offer server error");
        err.redirect = "/admin/productOffers?error=Server error";
        throw err;
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
        const err = new Error("Activate product offer server error");
        err.redirect = "/admin/productOffers?error=Server error";
        throw err;
    }
}

const deactivateProductOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        if(!offerId){
            return res.status(BAD_REQUEST).json({ success: false, message: "Offer not found!"})
        }
        
        await ProductOffer.findByIdAndUpdate(offerId, { isActive: false })
        return res.status(OK).json({ success: true, message: "Offer Deactivated"})
    } catch (error) {
        const err = new Error("Deactivate product offer server error");
        err.redirect = "/admin/productOffers?error=Server error";
        throw err;
    }
}

module.exports = {
    loadProductOffers,
    addProductOffer,
    editProductOffer,
    activateProductOffer,
    deactivateProductOffer
}