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
        console.error("Category management error:", error)
        res.redirect('/pageNotFound')
        
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
        console.error("Error adding category:", error);
        return res.redirect("/admin/category?error=" + encodeURIComponent("Internal server error"));
    }
};

const editCategory = async (req, res) => {
    try {
        const { id, name, description, status, offerDiscount, offerStart, offerEnd, removeOffer, offerStatus  } = req.body;

        if (!id || !name || !description) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Invalid data for update"));
        }

        const startDate = new Date(offerStart);
        const endDate = new Date(offerEnd)
        const today = new Date();
        if(startDate < today || endDate < today){
            return res.redirect("/admin/category?error=" + encodeURIComponent("Start date or End date should not be past!"));
        }else if(endDate < startDate) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("End date should not be before start date!"));
        }

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

        if(removeOffer) {
            await CategoryOffer.updateMany(
                { categoryId: id },
                { $set: { isActive: false } }
            );
        }else if(offerDiscount && offerStart && offerEnd) {
            

            if(offer) {
                offer.discountPercentage = offerDiscount;
                offer.startDate = offerStart;
                offer.endDate = offerEnd;
                offer.isActive = offerStatus === "true";
                await offer.save();
            } else { 
                await CategoryOffer.create({
                    categoryId: id,
                    discountPercentage: offerDiscount,
                    startDate: offerStart,
                    endDate: offerEnd,
                    isActive: offerStatus === 'true'
                });
            }
        }

        return res.redirect("/admin/category?success=" + encodeURIComponent("Category updated successfully"));
    } catch (error) {
        console.error("Edit Category error:", error);
        return res.redirect("/admin/category?error=" + encodeURIComponent("Internal server error"));
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
        console.error("Delete Category error:", error);
        return res.redirect("/admin/category?error=Internal server error");
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
        console.error("Activate Category error:", error);
        return res.redirect("/admin/category?error=" + encodeURIComponent("Internal server error"));
    }
};


module.exports = {
    categoryInfo,
    addCategory,
    editCategory,
    deleteCategory,
    activateCategory
}