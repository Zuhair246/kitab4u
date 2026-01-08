import Coupon from '../../models/couponSchema.js';

const loadCoupons = async (req, res) => {
    try {
        let today = new Date();
        today.setHours(0,0,0,0);
        await Coupon.updateMany(
            {
            expiryDate: {$lt:today},
            isActive: true
        },
        {
            $set:{
                isActive: false
            }
        }
    )

        const coupons = await Coupon.find().sort({ createdAt: -1 });
        let search;
        
        res.render('couponList', {
            coupons,
            search,
            totalPages:1,
            currentPage:1,
        })
        
    } catch (error) {
        const err = new Error("Admin coupon page load server error!");
        return next (err);
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
        const err = new Error("Add coupon server error");
        err.redirect = "/admin/coupons?error=" + encodeURIComponent("Add coupon internal server error");
        return next (err);
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
        const err = new Error("Edit coupon server error");
        err.redirect = "/admin/coupons?error=" + encodeURIComponent("Edit coupon internal server error");
        return next (err);
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
        const err = new Error("Delete coupon server error");
        err.redirect = "/admin/coupons?error=" + encodeURIComponent("Delete coupon internal server error");
        return next (err);
    }
}

const activateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);
        if(!coupon){
            return res.status(404).json({success: false, message: "Coupon not found for activating!"})
        }

        const today = new Date();
        today.setHours(0,0,0,0);
        if(coupon.expiryDate < today){
            return res.status(400).json({success:false, message: 'Coupon already expired!'});
        }

        coupon.isActive = true;
        await coupon.save();

        return res.status(200).json({ success: true, message: "Coupon re-activated!"});

    } catch (error) {
        const err = new Error("Activate coupon server error");
        err.redirect = "/admin/coupons?error=" + encodeURIComponent("Activate coupon internal server error");
        return next (err);
    }
}

const applyCoupon = async (req, res) => {
    try {
        const { code, finalAmount } = req.body;
        const userId = req.session.user || req.user;
        
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true, expiryDate: { $gt: new Date() }});
        const currentDate = new Date();
        currentDate.setHours(23, 59, 59, 999);

        if(!coupon || currentDate > coupon.expiryDate){
            return res.status(400).json({ success: false, message: "Invalid or expired coupon!"});
        }

        if(coupon.usedUsers.includes(userId)) {
            return res.status(400).json({ success: false, message: "You already used this coupon!"})
        }
        
        if(finalAmount < coupon.minPrice){
            return res.status(400).json({ success: false, message: `Minimum order of ₹${coupon.minPrice} is required to apply this coupon`})
        }
        
        req.session.appliedCoupon = {
            couponCode: coupon.code,
        };

        res.status(200).json({ success: true, message: "Coupon applied successfully"});
    } catch (error) {
        console.error(error);
        return res.status(500).json({
        success: false,
        message: "Apply coupon internal server error"
        });
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
        console.error(error);
        return res.status(500).json({
        success: false,
        message: "Remove coupon internal server error"
        });
    }
}

export default {
    loadCoupons,
    addCoupon,
    editCoupon,
    deleteCoupon,
    activateCoupon,
    applyCoupon,
    removeCoupon
}