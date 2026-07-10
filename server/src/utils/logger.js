// ========================================================================
// FILE : server/src/utils/logger.js
// ========================================================================

const winston = require("winston");

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `[${ts}] ${level}: ${stack || message} ${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
  exitOnError: false,
});

// Convenience wrappers so callers don't need to remember to pass context
// objects consistently — auth failures, AI errors, job failures, and
// notification failures should all be greppable by these prefixes.
logger.authFailure = (msg, meta = {}) => logger.warn(`[AUTH] ${msg}`, meta);
logger.aiServiceError = (msg, meta = {}) => logger.error(`[AI_SERVICE] ${msg}`, meta);
logger.jobFailure = (msg, meta = {}) => logger.error(`[JOB] ${msg}`, meta);
logger.notificationFailure = (msg, meta = {}) =>
  logger.error(`[NOTIFICATION] ${msg}`, meta);

module.exports = logger;