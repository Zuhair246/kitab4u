const multer = require("multer");

const storage = multer.memoryStorage(); // for diskStorage 

const upload = multer({ 
            storage,
            limits: {fileSize: 5 * 1024 * 1024},
            fileFilter:  (req, res, cb) => {
            const allowedTypes = /jpeg|jpg|png|webp/;
            const mimeType = allowedTypes.test(file.mimetype.toLowerCase());
            const extName = allowedTypes.test(file.originalname.toLowerCase());

            if (mimeType && extName) {
                cb(null, true);
            } else {
                cb(new Error("Only .jpeg, .jpg, .png, and .webp image files are allowed!"))
            }
        }
        });

module.exports = upload;
