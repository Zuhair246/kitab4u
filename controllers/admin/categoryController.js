const Category = require('../../models/categorySchema')

const categoryInfo = async (req,res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1)*limit;

        const search = req.query.search ? { name: { $regex: req.query.search, $options: "i" } } : {};

        const categoryData = await Category.find({})
        .sort ({createdAt: -1})
        .skip (skip)
        .limit(limit)

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit)
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
    const { name, description } = req.body;
    try {
        if (!name || !description) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Name and Description can't be empty"));
        }

        const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });
        if (existingCategory) {
            return res.redirect("/admin/category?error=" + encodeURIComponent("Category already exists"));
        }

        const newCategory = new Category({ name, description });
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
            return res.redirect("/admin/category?error=Invalid data for update");
        }

        await Category.findByIdAndUpdate(id, {
            name,
            description,
            isListed: status === "active" ? true : false
        });

        return res.redirect("/admin/category?success=Category updated successfully");
    } catch (error) {
        console.error("Edit Category error:", error);
        return res.redirect("/admin/category?error=Internal server error");
    }
};

// Delete category
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.redirect("/admin/category?error=Invalid category id");
        }

        await Category.findByIdAndDelete(id);

        return res.redirect("/admin/category?success=Category deleted successfully");
    } catch (error) {
        console.error("Delete Category error:", error);
        return res.redirect("/admin/category?error=Internal server error");
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    editCategory,
    deleteCategory
}