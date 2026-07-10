// ========================================================================
// FILE : server/src/middleware/upload.js
// ========================================================================

const multer = require("multer");
const ApiError = require("../utils/ApiError");

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Memory storage — buffer is streamed straight to Cloudinary
// (config/cloudinary.js), nothing touches disk except BullMQ job payloads
// which only carry the resulting URL, not the image itself.
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(ApiError.badRequest("Only JPEG, PNG, WEBP, or HEIC images are allowed"));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

module.exports = {
  uploadSingleImage: (fieldName = "image") => upload.single(fieldName),
};