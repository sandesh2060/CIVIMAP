// ========================================================================
// FILE : server/src/config/env.js
// ========================================================================

require("dotenv").config();

const REQUIRED_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "REFRESH_TOKEN_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "REDIS_URL",
  "AI_SERVICE_URL",
];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length) {
    // Fail fast at boot rather than crashing later mid-request.
    // eslint-disable-next-line no-console
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000,

  MONGO_URI: process.env.MONGO_URI,

JWT_SECRET: process.env.JWT_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || "15m",
  REFRESH_TOKEN_TTL_MS: Number(process.env.REFRESH_TOKEN_TTL_MS) || 7 * 24 * 60 * 60 * 1000,

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  REDIS_URL: process.env.REDIS_URL,

  AI_SERVICE_URL: process.env.AI_SERVICE_URL,
  AI_SERVICE_TIMEOUT_MS: process.env.AI_SERVICE_TIMEOUT_MS || 15000,
  AI_CONFIDENCE_THRESHOLD: Number(process.env.AI_CONFIDENCE_THRESHOLD) || 0.85,

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,

  OSRM_SERVER_URL: process.env.OSRM_SERVER_URL,

  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",
};

module.exports = { env, validateEnv };