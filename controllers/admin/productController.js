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
        const { name, author, description, categoryId,publisher,pages} = req.body;
        
        const variantsData = req.body.variants || [];
        const variants = [];

        variantsData.forEach((data) => {
            const coverType = data.coverType?.trim();
            const originalPrice = parseFloat(data.originalPrice);
            const discountPrice = data.discountPrice ? parseFloat(data.discountPrice) : null;
            const stock = parseInt(data.stock);
            if (!coverType || isNaN(originalPrice) || originalPrice <= 0 || isNaN(stock) || stock < 0) {
                return; 
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

        if (!name || !author || !description || !categoryId || !publisher || !pages || variants.length === 0) {
            return res.redirect('/admin/addProducts?error=' + encodeURIComponent('All fields are required, including at least one valid variant'));
        }

        const existingProduct = await Product.findOne({name})
        if(existingProduct){
            return res.redirect('/admin/addProducts?error=' + encodeURIComponent('This Book already exist '));
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            const uploadDir = path.join(__dirname, '../../public/uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            for (const file of req.files) {
                const fileName = `${Date.now()}_${file.originalname}`;
                const fullPath = path.join(uploadDir, fileName);
                await sharp(file.buffer) 
                    .resize(400, 600, { fit: 'contain' })
                    .toFile(fullPath);
                // fs.unlinkSync(file.path); // Only if diskStorage
                images.push(`/uploads/${fileName}`);
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
            publisher,
            pages: parseInt(pages),
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
            ? { name: { $regex: req.query.search, $options: "i" } }
            : {};

        const productData = await Product.find(search)
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(search);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render('productList', {
            products: productData,
            currentPage: page,
            totalPages,
            search: req.query.search || "",
            totalProducts,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Product list error:', error);
        res.redirect('/pageNotFound');
    }
};

const getEditProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findById(id).populate("categoryId");
        const cat = await Category.find();

        if (!product) {
            return res.redirect('/admin/listProducts?error=' + encodeURIComponent('Product not found'));
        }

        res.render("editProduct", {
            product,
            cat
        });
    } catch (error) {
        console.error("Error loading edit product page:", error);
        res.redirect('/admin/listProducts?error=' + encodeURIComponent('Internal server error'));
    }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, author, description, categoryId, publisher, pages, existingImages, isListed } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.redirect(`/admin/listProducts?error=` + encodeURIComponent("Product not found"));
    }

    const variantsData = req.body.variants || [];
    let variantError = null;

    const updatedIds = [];

    variantsData.forEach((data) => {
      const coverType = data.coverType?.trim();
      const originalPrice = parseFloat(data.originalPrice);
      const discountPrice = data.discountPrice ? parseFloat(data.discountPrice) : null;
      const stock = parseInt(data.stock);

      if (!coverType || isNaN(originalPrice) || originalPrice <= 0 || isNaN(stock) || stock < 0) {
        return; 
      }
      if (
        discountPrice !== null &&
        (isNaN(discountPrice) || discountPrice <= 0 || discountPrice >= originalPrice)
      ) {
        variantError = "Discount price must be less than original price";
        return;
      }

      if (data._id) {
        const existingVariant = product.variants.id(data._id);
        if (existingVariant) {
          existingVariant.coverType = coverType;
          existingVariant.originalPrice = originalPrice;
          existingVariant.discountPrice = discountPrice;
          existingVariant.stock = stock;
          updatedIds.push(existingVariant._id.toString());
        }
      } else {
        const newVariant = {
          coverType,
          originalPrice,
          discountPrice,
          stock,
        };
        product.variants.push(newVariant);
      }
    });

    if (variantError) {
      return res.redirect(`/admin/editProduct/${id}?error=` + encodeURIComponent(variantError));
    }

    product.variants = product.variants.filter((v) => updatedIds.includes(v._id.toString()) || !v._id);

    if (!name || !author || !description || !categoryId || !publisher || !pages || product.variants.length === 0) {
      return res.redirect(
        `/admin/editProduct/${id}?error=` +
          encodeURIComponent("All fields are required, including at least one valid variant")
      );
    }

    // --- Handle Images ---
    let images = existingImages ? (Array.isArray(existingImages) ? existingImages : [existingImages]) : [];

    if (req.files && req.files.length > 0) {
      const uploadDir = path.join(__dirname, "../../public/uploads");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      for (const file of req.files) {
        const fileName = `${Date.now()}_${file.originalname}`;
        const fullPath = path.join(uploadDir, fileName);
        await sharp(file.buffer).resize(400, 600, { fit: "contain" }).toFile(fullPath);
        images.push(`/uploads/${fileName}`);
      }
    }

    if (images.length < 3) {
      return res.redirect(
        `/admin/editProduct/${id}?error=` + encodeURIComponent("At least 3 images are required")
      );
    }

    product.name = name;
    product.author = author;
    product.description = description;
    product.categoryId = categoryId;
    product.publisher = publisher;
    product.pages = parseInt(pages);
    product.images = images;
    product.isBlocked = isListed !== "true";

    await product.save();

    return res.redirect(
      "/admin/listProducts?success=" + encodeURIComponent("Product updated successfully")
    );
  } catch (error) {
    console.error("Edit Product error:", error);
    return res.redirect(
      `/admin/editProduct/${req.params.id}?error=` + encodeURIComponent("Internal server error")
    );
  }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.redirect('/admin/listProducts?error=' + encodeURIComponent('Invalid product id'));
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.redirect('/admin/listProducts?error=' + encodeURIComponent('Product not found'));
        }

        product.isBlocked = !product.isBlocked;
        await product.save();

        const message = product.isBlocked ? 'Product unlisted successfully' : 'Product listed successfully';
        return res.redirect('/admin/listProducts?success=' + encodeURIComponent(message));
    } catch (error) {
        console.error('Toggle Product error:', error);
        return res.redirect('/admin/listProducts?error=' + encodeURIComponent('Internal server error'));
    }
};

module.exports = {
    getProductAddPage,
    getProductList,
    addProduct,
    getEditProduct,
    editProduct,
    deleteProduct
}