const Category = require('../../models/categorySchema');
const CategoryOffer = require("../../models/categoryOfferSchema");

const categoryInfo = async (req,res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1)*limit;

       let filter = {};

        if(req.query.search) {
            filter.name = {$regex: req.query.search, $options:"i"};
        }

        const category = await Category.find(filter)
        .sort ({createdAt: -1})
        .skip (skip)
        .limit(limit)
        .lean();

        const offers = await CategoryOffer.find({
            categoryId: { $in: category.map( c => c._id ) }
        }).lean();

        const categoryData = category.map(cat => {
            const offer = offers.find( ofr => ofr.categoryId.toString() === cat._id.toString());
            return { 
                            ...cat,
                             offer: offer || null
                             };
        })

        const totalCategories = await Category.countDocuments(filter);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages,
            search: req.query.search || "",
            totalCategories,
            error: req.query.error || null,
            success: req.query.success || null
        })
    
    } catch (error) {
        const err = new Error("Admin category page load server error");
        return next(err);
        
    }
}

const addCategory = async (req, res) => {
    const { name, description, status } = req.body; 
    try {
        if (!name || !description) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Name and Description can't be empty"));
        }

        const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });
        if (existingCategory) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Category already exists"));
        }

        const newCategory = new Category({
            name,
            description,
            isListed: status === "active"  
        });
        await newCategory.save();

        return res.redirect("/admin/category?success=" + encodeURIComponent("Category added successfully"));
    } catch (error) {
        const err = new Error("Add category server error");
        err.redirect = "/admin/category?error=" + encodeURIComponent("Add category internal server error")
        return next(err);
    }
};

const editCategory = async (req, res) => {
    try {
        const { id, name, description, status, offerDiscount, offerStart, offerEnd, offerStatus  } = req.body;

        if (!id || !name || !description) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Invalid data for update"));
        }

        const startDate = new Date(offerStart);
        const endDate = new Date(offerEnd);
        const today = new Date();
        if(startDate < today || endDate < today){
            return res.redirect("/admin/category?error=" + encodeURIComponent("Start date or Expiry date should not be past!"));
        }else if(endDate < startDate) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Expiry date should not be before Start date!"));
        }

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp("^" + name + "$", "i") },
            _id: { $ne: id }  //  ignore the category being edited
        });

        if (existingCategory) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Category already exists"));
        }

        await Category.findByIdAndUpdate(id, {
            name,
            description,
            isListed: status === "active"
        });

        const offer = await CategoryOffer.findOne({ categoryId: id });

 if(offerDiscount && offerStart && offerEnd) {
    
            if(offer) {
                offer.discountPercentage = offerDiscount;
                offer.startDate = startDate;
                offer.endDate = endDate;
                offer.isActive = offerStatus === "true";
                await offer.save();
            } else { 
                await CategoryOffer.create({
                    categoryId: id,
                    discountPercentage: offerDiscount,
                    startDate: startDate,
                    endDate: endDate,
                    isActive: offerStatus === 'true'
                });
            }
        }

        return res.redirect("/admin/category?success=" + encodeURIComponent("Category updated successfully"));
    } catch (error) {
        const err = new Error("Edit category server error");
        err.redirect = "/admin/category?error=" + encodeURIComponent("Edit category internal server error!")
        return next(err);
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.redirect("/admin/category?error=Invalid category id");
        }

        await Category.findByIdAndUpdate(id, {isListed:false});

        return res.redirect("/admin/category?success=Category deleted/unlisted successfully");
    } catch (error) {
        const err = new Error("Delete category server error!");
        err.redirect = "/admin/category?error=" + encodeURIComponent("Delete category internal server error!");
        return next(err);
    }
};

const activateCategory = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.redirect("/admin/category?error=Invalid category id");
        }

        await Category.findByIdAndUpdate(id, { isListed: true });

        return res.redirect("/admin/category?success=" + encodeURIComponent("Category activated successfully"));
    } catch (error) {
        const err = new Error("Activate category server error");
        err.redirect = "/admin/category?error=" + encodeURIComponent("Activate category internal server error!");
        return next (err);
    }
};


module.exports = {
    categoryInfo,
    addCategory,
    editCategory,
    deleteCategory,
    activateCategory
}