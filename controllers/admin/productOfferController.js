const Product = require('../../models/productSchema');
const ProductOffer = require('../../models/productOfferSchema');

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
            currentPage:1,
            totalPages:1
        });
    } catch (error) {
        console.log('Product offer loading error:', error);
        return res.redirect("/admin");
    }
}

const addProductOffer = async (req, res) => {
    try {
        const { productId, discountPercentage, startDate, endDate } = req.body;

        if ( !productId || !discountPercentage || !startDate || !endDate ) {
            return res.redirect("/admin/productOffers?error=Missing fields");
        }

        await ProductOffer.deleteMany({ productId });

        await ProductOffer.create({
            productId,
            discountPercentage,
            startDate,
            endDate,
            isActive: true
        });

        return res.redirect("/admin/productOffers?success=Product offer added");
    } catch (error) {
        console.log("Error adding product offer:", error);
        return res.redirect("/admin/productOffers?error=Server error");
    }
}

const editProductOffer = async (req, res) => {
    try {
        const { offerId, discountPercentage, startDate, endDate } = req.body;
        console.log('Loading edit for offer:', offerId);
        
        if(!offerId){
            return res.redirect("/admin/productOffers?error=Offer not found!");
        }
        if(!discountPercentage || !startDate || !endDate){
            return res.redirect("/admin/productOffers?error=Missing fields");
        }

        await ProductOffer.findByIdAndUpdate(offerId, {
            discountPercentage,
            startDate,
            endDate
        });

        return res.redirect("/admin/productOffers?success=Product offer updated");
    } catch (error) {
        console.log('Error edit product offer:', error);
        return res.redirect("/admin/productOffers?error=Server error");
    }
}

const activateProductOffer = async (req, res) => {
    try {
        const { offerId } = req.body;
        if(!offerId){
            return res.redirect("/admin/productOffers?error=Offer not found!");
        }

        await ProductOffer.findByIdAndUpdate(offerId, { isActive: true });
        
        return res.redirect("/admin/productOffers?success=Offer activated");
    } catch (error) {
        console.log("Error product offer activation:", error);
        return res.redirect("/admin/productOffers?error=Server error");
    }
}

const deactivateProductOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        if(!offerId){
            return res.redirect("/admin/productOffers?error=Offer not found!");
        }

        await ProductOffer.findByIdAndUpdate(offerId, { isActive: false })
        return res.redirect("/admin/productOffers?success=Offer removed");
    } catch (error) {
        console.log("Errror product offer removal:", error);
        return res.redirect("/admin/productOffers?error=Server error");
    }
}

module.exports = {
    loadProductOffers,
    addProductOffer,
    editProductOffer,
    activateProductOffer,
    deactivateProductOffer
}