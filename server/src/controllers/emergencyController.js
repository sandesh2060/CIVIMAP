// ========================================================================
// FILE : server/src/controllers/emergencyController.js
// ========================================================================

const EmergencyAlert = require("../models/EmergencyAlert");
const EmergencyContact = require("../models/EmergencyContact");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const emergencyService = require("../services/emergencyService");

async function createAlert(req, res, next) {
  try {
    const { category, location, note } = req.body;

    const { alert, channelsUsed, contact } = await emergencyService.createAndDispatchAlert({
      citizen: req.account,
      category,
      location,
      note,
    });

    return ApiResponse.created(
      res,
      {
        alert,
        channelsUsed,
        department: { name: contact.department, category: contact.category },
      },
      "Emergency alert dispatched"
    );
  } catch (err) {
    next(err);
  }
}

async function listAlerts(req, res, next) {
  try {
    const { status, category, page, limit } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const skip = (page - 1) * limit;
    const [alerts, total] = await Promise.all([
      EmergencyAlert.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reportedBy", "fullName phone email")
        .populate("contactedDepartment", "department category"),
      EmergencyAlert.countDocuments(filter),
    ]);

    return ApiResponse.ok(res, { alerts, total, page, limit });
  } catch (err) {
    next(err);
  }
}

async function myAlerts(req, res, next) {
  try {
    const alerts = await EmergencyAlert.find({ reportedBy: req.account._id })
      .sort({ createdAt: -1 })
      .populate("contactedDepartment", "department category");
    return ApiResponse.ok(res, { alerts });
  } catch (err) {
    next(err);
  }
}

async function getAlert(req, res, next) {
  try {
    const alert = await EmergencyAlert.findById(req.params.id)
      .populate("reportedBy", "fullName phone email")
      .populate("contactedDepartment");
    if (!alert) throw ApiError.notFound("Emergency alert not found");

    const isOwner = alert.reportedBy._id.equals(req.account._id);
    if (req.accountType !== "admin" && !isOwner) {
      throw ApiError.forbidden("Not authorized to view this alert");
    }

    return ApiResponse.ok(res, { alert });
  } catch (err) {
    next(err);
  }
}

async function resolveAlert(req, res, next) {
  try {
    const alert = await emergencyService.resolveAlert(req.params.id, req.account, req.accountType);
    return ApiResponse.ok(res, { alert }, "Alert marked resolved");
  } catch (err) {
    next(err);
  }
}

async function listContacts(req, res, next) {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    const contacts = await EmergencyContact.find(filter).select(
      "department category coverageArea isDefault"
    );
    return ApiResponse.ok(res, { contacts });
  } catch (err) {
    next(err);
  }
}

async function createContact(req, res, next) {
  try {
    const contact = await EmergencyContact.create(req.body);
    return ApiResponse.created(res, { contact });
  } catch (err) {
    next(err);
  }
}

async function updateContact(req, res, next) {
  try {
    const contact = await EmergencyContact.findById(req.params.id);
    if (!contact) throw ApiError.notFound("Emergency contact not found");

    Object.assign(contact, req.body);
    await contact.save();

    return ApiResponse.ok(res, { contact });
  } catch (err) {
    next(err);
  }
}

async function deleteContact(req, res, next) {
  try {
    const contact = await EmergencyContact.findById(req.params.id);
    if (!contact) throw ApiError.notFound("Emergency contact not found");
    contact.isActive = false;
    await contact.save();
    return ApiResponse.ok(res, { success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAlert,
  listAlerts,
  myAlerts,
  getAlert,
  resolveAlert,
  listContacts,
  createContact,
  updateContact,
  deleteContact,
};