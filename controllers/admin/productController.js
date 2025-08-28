const Product = require('../../models/productSchema')
const Category = require ('../../models/categorySchema')

const User = require('../../models/userSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const multer = require('multer')
const upload = multer({dest: "temp/"})

const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({isListed:true})
        
        res.render('productAdd', {
            cat: category
        });

    } catch (error) {
        console.error("Get Product Add Page error:", error);
        res.redirect('/pageNotFound')
    }
}

const addProduct = async (req, res) => {
    try {
        const { name, author, description, categoryId } = req.body;
        
        // Parse variants as array
        const variantsData = req.body.variants || [];
        const variants = [];

        // Handle as array (from dynamic form)
        variantsData.forEach((data) => {
            const coverType = data.coverType?.trim();
            const originalPrice = parseFloat(data.originalPrice);
            const discountPrice = data.discountPrice ? parseFloat(data.discountPrice) : null;
            const stock = parseInt(data.stock);

            // Skip invalid/empty variants (e.g., from hidden static sections if not removed)
            if (!coverType || isNaN(originalPrice) || originalPrice <= 0 || isNaN(stock) || stock < 0) {
                return; // Silently skip instead of erroring whole request
            }

            if (discountPrice !== null && (isNaN(discountPrice) || discountPrice <= 0 || discountPrice >= originalPrice)) {
                return res.redirect('/admin/addProducts?error=' + encodeURIComponent('Discount price must be less than original price'));
            }

            variants.push({
                coverType,
                originalPrice,
                discountPrice,
                stock
            });
        });

        if (!name || !author || !description || !categoryId || variants.length === 0) {
            return res.redirect('/admin/addProducts?error=' + encodeURIComponent('All fields are required, including at least one valid variant'));
        }

        // Handle images
        const images = [];
        if (req.files && req.files.length > 0) {
            const uploadPath = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

            for (const file of req.files) {
                const imagePath = `/uploads/${Date.now()}_${file.originalname}`;
                const fullPath = path.join(__dirname, '../../', imagePath); // Adjusted for correct path
                await sharp(file.buffer) // Use file.buffer if multer memoryStorage, or file.path if diskStorage
                    .resize(800, 800, { fit: 'contain' })
                    .toFile(fullPath);
                // fs.unlinkSync(file.path); // Only if diskStorage
                images.push(imagePath);
            }
        }

        if (images.length < 3) {
            return res.redirect('/admin/addProducts?error=' + encodeURIComponent('At least 3 images are required'));
        }

        const newProduct = new Product({
            name,
            author,
            description,
            categoryId,
            variants,
            images,
            isBlocked: req.body.isListed !== 'true'
        });
        await newProduct.save();
        console.log('New product saved:', newProduct);

        
        return res.redirect('/admin/listProducts?success=' + encodeURIComponent('Product added successfully'));
    } catch (error) {
        console.error('Add Product error:', error);
        return res.redirect('/admin/addProducts?error=' + encodeURIComponent('Internal server error'));
    }
};


const getProductList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const search = req.query.search
            ? { name: { $regex: req.query.search, $options: "i" }, isBlocked: false }
            : { isBlocked: false };

        const productData = await Product.find(search)
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments({ isBlocked: false });
        const totalPages = Math.ceil(totalProducts / limit);

        res.render('productList', {
            products: productData,
            currentPage: page,
            totalPages,
            search: req.query.search || "",
            totalProducts,
            error: req.query.error || null,
            success: req.query.success || null,
        });
    } catch (error) {
        console.error('Product list error:', error);
        res.redirect('/pageNotFound');
    }
};

const editProduct = async (req, res) => {
    try {
        const { id, name, description, categoryId } = req.body;
        let variants = req.body.variants;
        if (typeof variants === 'string') variants = JSON.parse(variants);

        if (!id || !name || !description || !categoryId || !variants || variants.length === 0) {
            return res.redirect('/admin/editProduct/list?error=Invalid data for update');
        }

        const existingProduct = await Product.findById(id);
        let images = existingProduct.images;
        if (req.files && req.files.length > 0) {
            images = [];
            const uploadPath = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

            for (const file of req.files) {
                const imagePath = `/uploads/${Date.now()}_${file.originalname}`;
                const fullPath = path.join(__dirname, '../../uploads' + imagePath);
                await sharp(file.path)
                    .resize(800, 800, { fit: 'contain' })
                    .toFile(fullPath);
                fs.unlinkSync(file.path);
                images.push(imagePath);
            }
        }

        await Product.findByIdAndUpdate(id, {
            name,
            description,
            categoryId,
            variants,
            images,
        });

        return res.redirect('/admin/listProducts/list?success=Product updated successfully');
    } catch (error) {
        console.error('Edit Product error:', error);
        return res.redirect('/admin/editProduct/list?error=Internal server error');
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.redirect('/admin/product/list?error=Invalid product id');
        }

        await Product.findByIdAndUpdate(id, { isBlocked: true });

        return res.redirect('/admin/product/list?success=Product blocked successfully');
    } catch (error) {
        console.error('Delete Product error:', error);
        return res.redirect('/admin/product/list?error=Internal server error');
    }
};

module.exports = {
    getProductAddPage,
    getProductList,
    addProduct,
    editProduct,
    deleteProduct
}