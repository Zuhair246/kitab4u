const multer = require("multer");

const storage = multer.memoryStorage(); // or diskStorage if you want files saved on disk

const upload = multer({ storage });

module.exports = upload;
