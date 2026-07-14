// ========================================================================
// FILE : server/src/routes/placeRoutes.js
// ========================================================================

const express = require("express");
const placeController = require("../controllers/placeController");
const { protect, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  createPlaceSchema,
  updatePlaceSchema,
  listPlacesQuerySchema,
  addCategorySchema,
} = require("../validators/placeValidators");

const router = express.Router();

router.get("/", validate(listPlacesQuerySchema, "query"), placeController.listPlaces);
router.get("/categories", placeController.listCategories);
router.get("/:id", placeController.getPlace);

router.post(
  "/",
  protect,
  adminOnly("canManagePlaces"),
  validate(createPlaceSchema),
  placeController.createPlace
);
router.post(
  "/categories",
  protect,
  adminOnly("canManagePlaces"),
  validate(addCategorySchema),
  placeController.addCategory
);
router.put(
  "/:id",
  protect,
  adminOnly("canManagePlaces"),
  validate(updatePlaceSchema),
  placeController.updatePlace
);
router.delete("/:id", protect, adminOnly("canManagePlaces"), placeController.deletePlace);

module.exports = router;