// ========================================================================
// FILE : server/src/routes/signalRoutes.js
// ========================================================================

const express = require("express");
const signalController = require("../controllers/signalController");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.get("/", signalController.listSignals);
router.post("/", protect, adminOnly("canManageSignals"), signalController.createSignal);
router.put(
  "/:signalId",
  protect,
  adminOnly("canManageSignals"),
  signalController.updateSignal
);

module.exports = router;