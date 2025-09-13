const Category = require('../../models/categorySchema')

const categoryInfo = async (req,res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1)*limit;

       let filter = {$or:[{isListed:true},{isListed:false}] };


        if(req.query.search) {
            filter.name = {$regex: req.query.search, $options:"i"};
        }

        const categoryData = await Category.find(filter)
        .sort ({createdAt: -1})
        .skip (skip)
        .limit(limit)
        .exec()

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
    const { name, description, status } = req.body;  // Add status here
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
            isListed: status === "active"  // Use the status from form
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
        const { id, name, description, status } = req.body;

        if (!id || !name || !description) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Invalid data for update"));
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