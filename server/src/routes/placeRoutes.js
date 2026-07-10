// ========================================================================
// FILE : server/src/routes/placeRoutes.js
// ========================================================================

const express = require("express");
const placeController = require("../controllers/placeController");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.get("/", placeController.listPlaces);
router.get("/categories", placeController.listCategories);
router.get("/:id", placeController.getPlace);

router.post("/", protect, adminOnly("canManagePlaces"), placeController.createPlace);
router.post("/categories", protect, adminOnly("canManagePlaces"), placeController.addCategory);
router.put("/:id", protect, adminOnly("canManagePlaces"), placeController.updatePlace);
router.delete("/:id", protect, adminOnly("canManagePlaces"), placeController.deletePlace);

module.exports = router;