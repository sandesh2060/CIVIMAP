// ========================================================================
// FILE : server/src/routes/emergencyRoutes.js
// ========================================================================

const express = require("express");
const emergencyController = require("../controllers/emergencyController");
const { protect, citizenOnly, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { emergencyAlertLimiter } = require("../middleware/rateLimiter");
const {
  createAlertSchema,
  listAlertsQuerySchema,
  listContactsQuerySchema,
  createContactSchema,
  updateContactSchema,
} = require("../validators/emergencyValidators");

const router = express.Router();

router.post(
  "/alerts",
  protect,
  citizenOnly,
  emergencyAlertLimiter,
  validate(createAlertSchema),
  emergencyController.createAlert
);

router.get(
  "/alerts",
  protect,
  adminOnly(),
  validate(listAlertsQuerySchema, "query"),
  emergencyController.listAlerts
);

router.get("/alerts/mine", protect, citizenOnly, emergencyController.myAlerts);

router.get("/alerts/:id", protect, emergencyController.getAlert);

router.patch("/alerts/:id/resolve", protect, emergencyController.resolveAlert);

router.get(
  "/contacts",
  validate(listContactsQuerySchema, "query"),
  emergencyController.listContacts
);

router.post(
  "/contacts",
  protect,
  adminOnly(),
  validate(createContactSchema),
  emergencyController.createContact
);

router.put(
  "/contacts/:id",
  protect,
  adminOnly(),
  validate(updateContactSchema),
  emergencyController.updateContact
);

router.delete("/contacts/:id", protect, adminOnly(), emergencyController.deleteContact);

module.exports = router;