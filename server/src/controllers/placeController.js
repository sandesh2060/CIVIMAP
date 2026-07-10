// ========================================================================
// FILE : server/src/controllers/placeController.js
// ========================================================================

const Place = require("../models/Place");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { broadcastPlaceEvent } = require("../sockets/mapSocket");

async function listPlaces(req, res, next) {
  try {
    const { bbox, category } = req.query;

    const places = bbox
      ? await Place.findWithinBounds(bbox.split(",").map(Number), category)
      : await Place.find({
          isDeleted: false,
          isActive: true,
          ...(category ? { category: category.toLowerCase() } : {}),
        });

    return ApiResponse.ok(res, { places });
  } catch (err) {
    next(err);
  }
}

async function getPlace(req, res, next) {
  try {
    const place = await Place.findOne({ _id: req.params.id, isDeleted: false });
    if (!place) throw ApiError.notFound("Place not found");
    return ApiResponse.ok(res, { place });
  } catch (err) {
    next(err);
  }
}

async function createPlace(req, res, next) {
  try {
    const { name, category, location, description, contact, icon, markerColor } = req.body;

    const place = await Place.create({
      name,
      category: category.toLowerCase(),
      location: { type: "Point", coordinates: [location.lng, location.lat] },
      description,
      contact,
      icon,
      markerColor,
      addedBy: req.account._id,
    });

    const { getIO } = require("../sockets");
    broadcastPlaceEvent(getIO(), "place:new", place);

    return ApiResponse.created(res, { place });
  } catch (err) {
    next(err);
  }
}

async function updatePlace(req, res, next) {
  try {
    const place = await Place.findOne({ _id: req.params.id, isDeleted: false });
    if (!place) throw ApiError.notFound("Place not found");

    const updatable = ["name", "category", "description", "contact", "icon", "markerColor", "isActive"];
    updatable.forEach((field) => {
      if (req.body[field] !== undefined) place[field] = req.body[field];
    });

    if (req.body.location) {
      place.location = {
        type: "Point",
        coordinates: [req.body.location.lng, req.body.location.lat],
      };
    }

    await place.save();

    const { getIO } = require("../sockets");
    broadcastPlaceEvent(getIO(), "place:updated", place);

    return ApiResponse.ok(res, { place });
  } catch (err) {
    next(err);
  }
}

async function deletePlace(req, res, next) {
  try {
    const place = await Place.findOne({ _id: req.params.id, isDeleted: false });
    if (!place) throw ApiError.notFound("Place not found");

    place.isDeleted = true;
    place.deletedAt = new Date();
    await place.save();

    const { getIO } = require("../sockets");
    broadcastPlaceEvent(getIO(), "place:deleted", { _id: place._id });

    return ApiResponse.ok(res, null, "Place deleted");
  } catch (err) {
    next(err);
  }
}

// Categories are free-text on Place (admins can invent new ones), so
// "adding" a category is really just documenting the intent to use it —
// there is no separate category collection to write to. This endpoint
// validates the name and returns the current distinct set for the UI.
async function addCategory(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      throw ApiError.badRequest("Category name is required");
    }

    const categories = await Place.distinct("category");
    const normalized = name.trim().toLowerCase();
    if (!categories.includes(normalized)) categories.push(normalized);

    return ApiResponse.created(res, { category: normalized, allCategories: categories });
  } catch (err) {
    next(err);
  }
}

async function listCategories(req, res, next) {
  try {
    const dynamicCategories = await Place.distinct("category");
    const defaults = Place.defaultCategories();
    const merged = Array.from(new Set([...defaults, ...dynamicCategories]));
    return ApiResponse.ok(res, { categories: merged });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPlaces,
  getPlace,
  createPlace,
  updatePlace,
  deletePlace,
  addCategory,
  listCategories,
};