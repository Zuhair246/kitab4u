const { encodeXText } = require('nodemailer/lib/shared');
const upload = require('../middlewares/upload');

const uploadImages = (req, res, next) => {
    upload.array("images",5)(req, res, function (err) {
        if (err) {
            return res.redirect('/admin/addProducts?error=' +encodeURIComponent(err.message));
        }
        next()
    });
};

module.exports = uploadImages;