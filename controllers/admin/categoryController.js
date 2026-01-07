import Category from '../../models/categorySchema.js'
import CategoryOffer from '../../models/categoryOfferSchema.js';
import {statusCodes} from '../../helpers/statusCodes.js';
import { json } from 'express';
const {BAD_REQUEST, CONFLICT, OK, SERVER_ERROR} = statusCodes;

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
            return res.status(BAD_REQUEST).json({ success: false, message: "Name and Description can't be empty"});
        }

        const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });
        if (existingCategory) {
            return res.status(CONFLICT).json({ success: false, message: "Category already exists"});
        }

        const newCategory = new Category({
            name,
            description,
            isListed: status === "active"  
        });
        await newCategory.save();

        return res.status(OK).json({ success: true, message: "Category added successfully" })
    } catch (error) {
        console.error(error);
        return res.status(SERVER_ERROR).json({
        success: false,
        message: "Add category internal server error"
        });
    }
};

const editCategory = async (req, res) => {
    try {
        const { id, name, description, status, offerDiscount, offerStart, offerEnd, offerStatus  } = req.body;

        if (!id || !name || !description) {
            return res.status(BAD_REQUEST).json({ success: false, message: "Insufficient data for update"})
        }

        let startDate, endDate;
        
        if(offerDiscount && offerStart && offerEnd) {
            startDate = new Date(offerStart);
            endDate = new Date(offerEnd);
            endDate.setHours(23, 59, 59, 999);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
    
            if(startDate < today || endDate < today){
                return res.status(BAD_REQUEST).json({ success: false, message: "Start date or Expiry date should not be past!"});
            }
    
            if(endDate < startDate) {
                return res.status(BAD_REQUEST).json({ success: false, message: "Expiry date should not be before Start date!"});
            }
        }
        
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp("^" + name + "$", "i") },
            _id: { $ne: id }  //  ignore the category being edited
        });

        if (existingCategory) {
            return res.status(CONFLICT).json({ success: false, message: "Category already exists"});
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

        return res.status(OK).json({ success: true, message: "Category updated successfully"})
    } catch (error) {
        console.error(error);
        return res.status(SERVER_ERROR).json({
        success: false,
        message: "Edit category internal server error"
        });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(BAD_REQUEST).json({ success: false, message: "Invalid category id"})
        }

        await Category.findByIdAndUpdate(id, {isListed:false});

        return res.status(OK).json({ success: true, message: "Category unlisted successfully"})
    } catch (error) {
        console.error(error);
        return res.status(SERVER_ERROR).json({
        success: false,
        message: "Delete category internal server error"
        });
    }
};

const activateCategory = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(BAD_REQUEST).json({ success: false, message: "Invalid category id"});
        }

        await Category.findByIdAndUpdate(id, { isListed: true });

        return res.status(OK).json({ success: true, message: "Category activated successfully"})
    } catch (error) {
        console.error(error);
        return res.status(SERVER_ERROR).json({
        success: false,
        message: "Activate category internal server error"
        });
    }
};

export default {
    categoryInfo,
    addCategory,
    editCategory,
    deleteCategory,
    activateCategory
}