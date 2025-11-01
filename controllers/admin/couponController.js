const Coupon = require('../../models/couponSchema');
const User = require('../../models/userSchema');
const { search } = require('../../routes/adminRouter');

const loadCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
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

module.exports = {
    loadCoupons,
    addCoupon,
    editCoupon,
    deleteCoupon,
    activateCoupon
}