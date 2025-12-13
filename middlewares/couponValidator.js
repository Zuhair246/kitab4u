export const valdateCoupon = (req, res, next) => {
    try {
        let { name, code, discountType, discountValue, minPrice, maxDiscAmount, expiryDate } = req.body || {} ;
        
        name = name?.trim()
        code = code?.trim()

        minPrice = minPrice ? Number(minPrice) : 0 ;
        maxDiscAmount = maxDiscAmount ? Number(maxDiscAmount) : 0 ;

        discountValue = Number(discountValue) ;

        if(!name || !code || !discountType || !discountValue || !expiryDate){
            return res.status(400).json({ success: false, message: "Name, Coupon code, Discount Type, Discount Value and Expiry Date are required!"})
        }
        
        if(discountValue <= 0){
            return res.status(400).json({ success: false, message: "Discount value should be more than 0"})
        }
        
        if(minPrice < 0) {
            return res.status(400).json({ success: false, message: "Minumum order value should not be less than 0"})
        }
        
        if(maxDiscAmount < 0){
            return res.status(400).json({ success: false, message: "Maximum discount amount should be greater than 0"})
        }

        const expDate = new Date(expiryDate);
        expDate.setHours(23, 59, 59, 999);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if(expDate < today){
            return res.status(400).json({ success: false, message: "Expiry date cannot be past!"})
        }

        expiryDate = expDate;

        req.couponData = { name, code, discountType, discountValue, minPrice, maxDiscAmount, expiryDate };
        next();

    } catch (error) {
        console.log("Coupon validation error:", error);
        return res.status(500).json({ success: false, message: "Coupon validaion server error!"})   
    }
 };
 