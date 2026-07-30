const multer = require("multer")


const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 3 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const mime = (file.mimetype || "").toLowerCase();
        const name = (file.originalname || "").toLowerCase();
        const isPdf =
            mime === "application/pdf" ||
            mime === "application/x-pdf" ||
            name.endsWith(".pdf");

        if (!isPdf) {
            const err = new Error("Only PDF files are allowed.");
            err.status = 400;
            return cb(err);
        }
        cb(null, true);
    },
});


module.exports = upload