import Product from '../../models/productSchema.js'
import Category from '../../models/categorySchema.js';
import { uploadToCloudinary } from '../../helpers/cloudinaryUpload.js';

const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({isListed:true})
        
        res.render('productAdd', {
            cat: category
        });

    } catch (error) {
        const err = new Error("Add Product Page load server error");
        throw err;
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

            for (const file of req.files) {
                const result = await uploadToCloudinary(
                  file.buffer,
                  "products",
                  {
                    transformation: [
                      {
                        width: 400,
                        height: 600,
                        crop: "fit",
                        quality: "auto",
                        fetch_format:"auto"
                      }
                    ]
                  }
                );
                images.push(result.secure_url);
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
        const err = new Error("Add product server error");
        err.redirect = `/admin/addProducts?error=` + encodeURIComponent("Add product internal server error");
        throw err;
    }
};

const getProductList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
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
            limit,
            search: req.query.search || "",
            totalProducts,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        const err = new Error("Admin list products server error");
        err.redirect = `/admin/listProducts?error=` + encodeURIComponent("Admin list products internal server error");
        throw err;
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
            cat,
        });
    } catch (error) {
        const err = new Error("Edit product server error");
        err.redirect = `/admin/listProducts?error=` + encodeURIComponent("Edit product internal server error");
        throw err;
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
    let images = existingImages
                          ? Array.isArray(existingImages)
                            ? existingImages
                            : [existingImages]
                          : [];

    if (req.files && req.files.length > 0) {

      for (const file of req.files) {
        const result = await uploadToCloudinary (
          file.buffer,
          "products",
          {
            transformation: [
            {
              width: 400,
              height: 600,
              crop: "fit",
              quality: "auto",
              fetch_format: "auto"
            }
          ]
          }
        );
        images.push(result.secure_url);
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
    console.log(error);
    
        const err = new Error("Edit product server error");
        err.redirect = `/admin/editProduct/${req.params.id}?error=` + encodeURIComponent("Edit product internal server error");
        throw err;
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
        const err = new Error("Unlist product server error");
        err.redirect = `/admin/listProducts?error=` + encodeURIComponent("Unlist product internal server error");
        throw err;
    }
};

export default {
    getProductAddPage,
    getProductList,
    addProduct,
    getEditProduct,
    editProduct,
    deleteProduct
}