// ========================================================================
// FILE : server/src/routes/mapRoutes.js
// ========================================================================

const express = require("express");
const mapController = require("../controllers/mapController");

const router = express.Router();

router.get("/route", mapController.getRoute);

module.exports = router;