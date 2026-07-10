// ========================================================================
// FILE : server/src/utils/aiServiceClient.js
// ========================================================================

const axios = require("axios");
const { env } = require("../config/env");
const logger = require("./logger");

const client = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: Number(env.AI_SERVICE_TIMEOUT_MS) || 15000,
});

/**
 * All three AI endpoints share a response contract:
 * { confidence, result, flagForReview }
 * (see README section 6.4). Callers should NOT let a thrown error here
 * silently drop a report/violation — always catch and fall back to
 * "flagged" status for manual admin review (see jobs/*).
 */

/**
 * @returns {{
 *   plateText: string|null,        // full cleaned OCR string, Devanagari script
 *   plateNumberDigits: string|null,// isolated digit tail — USE THIS for
 *                                  // registry matching (via plateNormalizer.js),
 *                                  // not plateText, which includes province text
 *   confidence: number,
 *   croppedImageUrl: string|null,
 *   flagForReview: boolean,
 *   rawOcrText: string             // pre-correction OCR output, for debugging
 *                                  // OCR accuracy — don't use for matching
 * }}
 */
async function detectPlate(imageUrl) {
  try {
    const { data } = await client.post("/plate-detection", { imageUrl });
    return data;
  } catch (err) {
    logger.aiServiceError("detectPlate failed", { imageUrl, error: err.message });
    throw err;
  }
}

async function verifyRoadDamage(imageUrl) {
  try {
    const { data } = await client.post("/road-damage-verification", { imageUrl });
    return data; // { label, confidence, flagForReview }
  } catch (err) {
    logger.aiServiceError("verifyRoadDamage failed", { imageUrl, error: err.message });
    throw err;
  }
}

async function moderateImage(imageUrl) {
  try {
    const { data } = await client.post("/image-moderation", { imageUrl });
    return data; // { isPhotographic, isSpam, confidence }
  } catch (err) {
    logger.aiServiceError("moderateImage failed", { imageUrl, error: err.message });
    throw err;
  }
}

module.exports = { detectPlate, verifyRoadDamage, moderateImage };