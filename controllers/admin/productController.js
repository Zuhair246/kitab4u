import Product from '../../models/productSchema.js'
import Category from '../../models/categorySchema.js';
import { uploadToCloudinary } from '../../helpers/cloudinaryUpload.js';
import { json } from 'express';

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

        if (!name || !author || !description || !categoryId || !publisher || !pages || variants.length === 0) {
              return res.status(400).json({
                  success: false,
                  message: "All fields are required, including at least one valid variant"
            });        
      }
        
        const variantsData = req.body.variants || [];
        const variants = [];

        for (const data of variantsData) {
            const coverType = data.coverType?.trim();
            const originalPrice = parseFloat(data.originalPrice);
            const discountPrice = data.discountPrice ? parseFloat(data.discountPrice) : null;
            const stock = parseInt(data.stock);
            if (!coverType || isNaN(originalPrice) || originalPrice <= 0 || isNaN(stock) || stock < 0) {
                  return res.status(400).json({
                    success: false,
                    message: "Invalid variant data"
                  });
            }

          if (discountPrice !== null && (isNaN(discountPrice) || discountPrice <= 0 || discountPrice > originalPrice)) {
                return res.status(400).json({
                    success: false,
                    message: "Discount price must be less than or equal to original price"
              });            
        }

            variants.push({
                coverType,
                originalPrice,
                discountPrice,
                stock
            });
        };

        const existingProduct = await Product.findOne({name})
        if(existingProduct){
            return res.status(409).json({
              success: false,
              message: "This book already exists"
      });        }

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
            return res.status(400).json({
              success: false,
              message: "At least 3 images are required"
            });        
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

        
      return res.status(201).json({
        success: true,
        message: "Product added successfully",
        redirect:'/admin/listProducts'
      });

      } catch (error) {
        const err = new Error("Add product server error");
        err.redirect = `/admin/addProducts`
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
      return res.status(404).json({
        success: false, message: "Product not found"
      })
    }

    const variantsData = req.body.variants || [];
    if (!variantsData.length) {
      return res.status(400).json({
        success: false,
        message: "At least one variant is required"
      });
    }

    const updatedVariantIds = [];
    const newVariants = [];

    for (const data of variantsData ) {
      const coverType = data.coverType?.trim();
      const originalPrice = parseFloat(data.originalPrice);
      const discountPrice = data.discountPrice ? parseFloat(data.discountPrice) : null;
      const stock = parseInt(data.stock);

      if (!coverType || isNaN(originalPrice) || originalPrice <= 0 || isNaN(stock) || stock < 0) {
        return res.status(400).json({
          success: false, message: "Invalid variant data"
        });
      }
      if (
        discountPrice !== null &&
        (isNaN(discountPrice) || discountPrice <= 0 || discountPrice > originalPrice)
      ) {
        return res.status(400).json({
          success: false, message: "Discount price must be less than or equal to original price"
        });
      }

      if (data._id) {
        const existingVariant = product.variants.id(data._id);
        if (!existingVariant) {
          return res.status(400).json({
            success: false,
            message: "Invalid variant ID"
          });
        }

          existingVariant.coverType = coverType;
          existingVariant.originalPrice = originalPrice;
          existingVariant.discountPrice = discountPrice;
          existingVariant.stock = stock;
          updatedVariantIds.push(existingVariant._id.toString());

      } else {
        newVariants.push ({
          coverType,
          originalPrice,
          discountPrice,
          stock,
        });
      }
    };

    product.variants = product.variants.filter((v) => updatedVariantIds.includes(v._id.toString()) );
    product.variants.push(...newVariants);

    if (product.variants.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one variant is required"
      });
    }

    if (!name || !author || !description || !categoryId || !publisher || !pages || product.variants.length === 0) {
      return res.status(400).json({
        success: false, message: "All fields are required, including at least one valid variant"
      })
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
      return res.status(400).json({
        success: false, message: "At least 3 images are required"
      })
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

    return res.status(200).json({
      success: true, message: "Product updated successfully", redirect: "/admin/listProducts"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Edit product internal server error"
    });
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