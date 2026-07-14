// ========================================================================
// FILE : server/src/validators/feedValidators.js
// ========================================================================
const Joi = require("joi");

const createPostSchema = Joi.object({
  title: Joi.string().trim().min(2).max(150).required(),
  titleNe: Joi.string().trim().min(2).max(150).allow("", null).optional(),
  body: Joi.string().trim().min(2).max(3000).required(),
  bodyNe: Joi.string().trim().min(2).max(3000).allow("", null).optional(),
  category: Joi.string()
    .valid("announcement", "road", "traffic", "safety", "maintenance", "other")
    .default("announcement"),
  imageUrl: Joi.string().uri().allow("", null).optional(),
  isPinned: Joi.boolean().default(false),
  status: Joi.string().valid("draft", "published").default("published"),
});

const updatePostSchema = Joi.object({
  title: Joi.string().trim().min(2).max(150),
  titleNe: Joi.string().trim().min(2).max(150).allow("", null),
  body: Joi.string().trim().min(2).max(3000),
  bodyNe: Joi.string().trim().min(2).max(3000).allow("", null),
  category: Joi.string().valid("announcement", "road", "traffic", "safety", "maintenance", "other"),
  imageUrl: Joi.string().uri().allow("", null),
  isPinned: Joi.boolean(),
  commentsDisabled: Joi.boolean(),
  status: Joi.string().valid("draft", "published"),
}).min(1);

const commentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(500).required(),
  parentComment: Joi.string().hex().length(24).allow(null).optional(),
});

module.exports = { createPostSchema, updatePostSchema, commentSchema };