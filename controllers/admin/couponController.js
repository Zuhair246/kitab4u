const Coupon = require('../../models/couponSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema')

const loadCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        let search;
        res.render('couponList', {
            coupons,
            search,
            totalPages:1,
            currentPage:1,
        })
        
    } catch (error) {
        console.log('Error fetching coupons:', error);
        return res.redirect('/pageNotFound')
    }
};

const addCoupon = async (req, res) => {
    try {
       const data = req.couponData;

        const existing = await Coupon.findOne({ code: data.code });
        if(existing) {
            return res.status(400).json({ success: false, message: "Coupon code already exists"})
        }

        await Coupon.create(data)

        return res.status(201).json({success: true, message: "New Coupon Added"});
    } catch (error) {
        console.log('Error coupon adding:', error);
        return res.status(500).json({success: false, message: "Internal server while adding coupon"})
    }
}

const editCoupon = async (req, res) => {
    try {
        const data = req.couponData;
        const { id } = req.params;

        const existingCoupon = await Coupon.findOne({code: data.code, _id:{$ne: id}});
        if(existingCoupon){
            return res.status(400).json({ success: false, message: "Coupon code already exist"})
        }

        await Coupon.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true
        })
        return res.status(200).json({ success: true, message: "Coupon updated successfully!"})

    } catch (error) {
        console.log("Error editing coupon:", error);
        return res.status(500).json({success: false, message: "Internal server error when editing coupon"})
    }
}

const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndUpdate(id, {isActive: false});
        if(!coupon) {
            return res.status(404).json( { success: false, message: "Coupon not found for deactivating!"} );
        }
        return res.status(200).json({ success: true, message: "Coupon removed"})
    } catch (error) {
        console.log("Error coupon deleting:",error);
        return res.status(500).json({success: false, message: "Internal server error coupon deletion"})
    }
}

const activateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndUpdate(id, {isActive: true});
        if(!coupon){
            return res.status(404).json({success: false, message: "Coupon not found for activating!"})
        }
        return res.status(200).json({ success: true, message: "Coupon re-activated!"});
    } catch (error) {
        console.log("Error activating coupon:", error);
        return res.status(500).json({ success: false, message: "Internal server error while activating coupon"})
    }
}

const applyCoupon = async (req, res) => {
    try {
        const { code, finalAmount } = req.body;
        const userId = req.session.user || req.user;
        
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true});
        const currentDate = new Date();

        if(!coupon || currentDate> coupon.expiryDate){
            return res.status(400).json({ success: false, message: "Invalid or expired coupon!"});
        }

        if(coupon.usedUsers.includes(userId)) {
            return res.status(400).json({ success: false, message: "You already used this coupon!"})
        }
        
        if(finalAmount < coupon.minPrice){
            return res.status(400).json({ success: false, message: `Minimum order of ₹${coupon.minPrice} is required to apply this coupon`})
        }

        let discountAmount = 0;

        if(coupon.discountType === 'percentage') {
            discountAmount = (finalAmount * coupon.discountValue) / 100 ;

            if(coupon.maxDiscAmount > 0) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscAmount);
            }
        } //add else condition as flat disc. amount here.

            
        let discountedPrice = Math.round( finalAmount - discountAmount ) ;
        discountedPrice = Math.max(discountedPrice, 0); //for avoiding hacker manipulation in price.
        
        req.session.appliedCoupon = {
            couponCode: code,
            discountAmount,
            discountFinalAmount: discountedPrice,
            userId
        };

        res.status(200).json({ success: true, discountFinalAmount: discountedPrice, discount: discountAmount, couponCode: code, message: "Coupon applied"});
    } catch (error) {
        console.log("Error coupon apply: ", error);
        res.status(500).json({ success: false, message: "Server error occured while applying coupon!"})
        
    }
}

const removeCoupon = async (req, res) => {
    try {
        delete req.session.appliedCoupon;
        
        return res.status(200).json({
            success: true,
            message: "Coupon removed!"
        })
        
    } catch (error) {
        console.log('Remove coupon error:', error);
        return res.status(500).json({ success: false, message: "Remove coupon server error!"})
    }
}

module.exports = {
    loadCoupons,
    addCoupon,
    editCoupon,
    deleteCoupon,
    activateCoupon,
    applyCoupon,
    removeCoupon
}