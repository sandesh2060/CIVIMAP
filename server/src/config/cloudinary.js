// ========================================================================
// FILE : server/src/config/cloudinary.js
// ========================================================================

const cloudinary = require("cloudinary").v2;
const { env } = require("./env");
const logger = require("../utils/logger");

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads an in-memory buffer (from multer memoryStorage) to Cloudinary.
 * Returns { url, publicId }.
 */
function uploadBuffer(buffer, folder = "civimap") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) {
          logger.error("Cloudinary upload failed", { error: error.message });
          return reject(error);
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.error("Cloudinary delete failed", { publicId, error: err.message });
  }
}

module.exports = { cloudinary, uploadBuffer, deleteImage };