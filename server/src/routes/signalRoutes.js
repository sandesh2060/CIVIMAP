// ========================================================================
// FILE : server/src/routes/signalRoutes.js
// ========================================================================

const express = require("express");
const signalController = require("../controllers/signalController");
const { protect, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  createSignalSchema,
  updateSignalSchema,
  listSignalsQuerySchema,
} = require("../validators/signalValidators");

const router = express.Router();

router.get("/", validate(listSignalsQuerySchema, "query"), signalController.listSignals);

router.post(
  "/",
  protect,
  adminOnly("canManageSignals"),
  validate(createSignalSchema),
  signalController.createSignal
);

router.put(
  "/:signalId",
  protect,
  adminOnly("canManageSignals"),
  validate(updateSignalSchema),
  signalController.updateSignal
);

module.exports = router;