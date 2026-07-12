// ========================================================================
// FILE : server/src/notifications/emailService.js
// All templates now render through wrapEmail() below — a shared,
// letterhead-style HTML shell using CIVIMAP's actual palette (see
// client/src/index.css :root — hex values hardcoded here on purpose,
// since email clients do not support CSS custom properties or
// backdrop-filter/box-shadow the way browsers do).
// ========================================================================

const { sendMail } = require("../utils/email");
const { env } = require("../config/env");

// ---- Brand constants (mirrors client/src/index.css :root) ----
const COLORS = {
  crimson: "#DC143C",
  crimsonDark: "#B01030",
  blue: "#003893",
  blueDark: "#002A6E",
  gold: "#C89B3C",
  green: "#1E5631",
  bg: "#F8F6F1",
  surface: "#FFFDF9",
  surface2: "#F1EDE4",
  border: "#E5E0D4",
  text: "#1C1A17",
  muted: "#6F6A5E",
  faint: "#A39C8C",
  onBrand: "#FFFDF9",
  crimsonSoft: "#F7E6E8",
  blueSoft: "#E6ECF5",
};

const LOGO_URL =
  "https://i.pinimg.com/1200x/00/a7/ce/00a7ceb6a0b19cf89d282a8cba0d771f.jpg";

/**
 * Shared letterhead shell for every CIVIMAP email. Mimics an official
 * government notice: crest + title band, a thin tricolor rule, a plain
 * "letter" body area, and a formal footer with a reference/ID line.
 *
 * @param {Object} opts
 * @param {string} opts.preheader - hidden preview text (inbox summary)
 * @param {string} opts.eyebrow - small caps label above the title, e.g. "TRAFFIC VIOLATION NOTICE"
 * @param {string} opts.title - main heading, e.g. "Notice of Recorded Violation"
 * @param {string} opts.bodyHtml - the letter content (already-safe HTML)
 * @param {string} [opts.referenceId] - shown in the footer as "Reference: ..."
 * @param {"crimson"|"blue"|"green"} [opts.accent="crimson"] - band/eyebrow accent
 */
function wrapEmail({ preheader, eyebrow, title, bodyHtml, referenceId, accent = "crimson" }) {
  const accentColor =
    accent === "blue" ? COLORS.blue : accent === "green" ? COLORS.green : COLORS.crimson;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.surface2};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">
    ${preheader || ""}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface2};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:10px;overflow:hidden;">

          <!-- letterhead -->
          <tr>
            <td style="padding:28px 32px 20px 32px;border-bottom:1px solid ${COLORS.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48" valign="middle" style="padding-right:14px;">
                    <img src="${LOGO_URL}" width="44" height="44" alt="Government of Nepal emblem" style="display:block;border-radius:6px;" />
                  </td>
                  <td valign="middle">
                    <div style="font-size:17px;font-weight:700;color:${COLORS.text};letter-spacing:0.01em;">CIVIMAP</div>
                    <div style="font-size:11px;color:${COLORS.muted};letter-spacing:0.06em;text-transform:uppercase;margin-top:1px;">Nepal National Problem &amp; Traffic Reporting Platform</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- tricolor rule -->
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr style="height:4px;">
                  <td width="33.33%" style="background:${COLORS.crimson};height:4px;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="33.33%" style="background:${COLORS.blue};height:4px;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="33.34%" style="background:${COLORS.gold};height:4px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- eyebrow + title -->
          <tr>
            <td style="padding:28px 32px 4px 32px;">
              ${eyebrow ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${accentColor};margin-bottom:8px;">${eyebrow}</div>` : ""}
              <div style="font-size:20px;font-weight:700;color:${COLORS.text};line-height:1.3;">${title}</div>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:12px 32px 28px 32px;font-size:14px;line-height:1.65;color:${COLORS.text};">
              ${bodyHtml}
            </td>
          </tr>

          ${
            referenceId
              ? `<tr>
                  <td style="padding:0 32px 24px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface2};border:1px solid ${COLORS.border};border-radius:8px;">
                      <tr>
                        <td style="padding:12px 16px;font-size:12px;color:${COLORS.muted};">
                          <span style="text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:${COLORS.faint};">Reference</span>
                          &nbsp;·&nbsp;
                          <span style="font-family:'SFMono-Regular',Consolas,Menlo,monospace;color:${COLORS.text};">${referenceId}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
              : ""
          }

          <!-- footer -->
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid ${COLORS.border};background:${COLORS.surface2};">
              <div style="font-size:11px;color:${COLORS.muted};line-height:1.6;">
                This is an automated notice issued by the CIVIMAP citizen reporting platform on behalf of local traffic authorities. Do not reply directly to this email.
                If you believe this notice was issued in error, please contact your local traffic office and reference the ID above.
              </div>
              <div style="font-size:11px;color:${COLORS.faint};margin-top:10px;">
                © ${new Date().getFullYear()} CIVIMAP &nbsp;·&nbsp; <a href="${env.CLIENT_ORIGIN}" style="color:${COLORS.blue};text-decoration:none;">${env.CLIENT_ORIGIN.replace(/^https?:\/\//, "")}</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function fmtCoords(location) {
  return `${location.coordinates[1].toFixed(5)}, ${location.coordinates[0].toFixed(5)}`;
}

function mapsLinkFromPoint(location) {
  return `https://www.google.com/maps?q=${location.coordinates[1]},${location.coordinates[0]}`;
}

// ------------------------------------------------------------------
// Violation notices
// ------------------------------------------------------------------

async function sendOwnerViolationEmail(violation) {
  if (!violation.matchedOwner?.email) return { success: false, error: "No owner email" };

  const mapsLink = mapsLinkFromPoint(violation.location);

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Dear ${violation.matchedOwner.name || "Vehicle Owner"},</p>
    <p style="margin:0 0 16px 0;">
      A traffic violation has been recorded against a vehicle registered to you, bearing plate number
      <strong>${violation.extractedPlateNumber}</strong>. Details are provided below for your reference.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="padding:6px 0;width:120px;color:${COLORS.muted};font-size:13px;">Plate Number</td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;">${violation.extractedPlateNumber}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;">Date &amp; Time</td>
        <td style="padding:6px 0;font-size:13px;">${violation.createdAt.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;">Location</td>
        <td style="padding:6px 0;font-size:13px;">
          ${fmtCoords(violation.location)} &nbsp;·&nbsp;
          <a href="${mapsLink}" style="color:${COLORS.blue};text-decoration:none;">View on map</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;">
      If you believe this notice has been issued in error, please contact the traffic authority
      and quote the reference number below.
    </p>
  `;

  return sendMail({
    to: violation.matchedOwner.email,
    subject: `Traffic Violation Notice — Plate ${violation.extractedPlateNumber}`,
    html: wrapEmail({
      preheader: `A traffic violation was recorded for plate ${violation.extractedPlateNumber}.`,
      eyebrow: "Traffic Violation Notice",
      title: "Notice of Recorded Traffic Violation",
      bodyHtml,
      referenceId: violation._id.toString(),
      accent: "crimson",
    }),
  });
}

async function sendAdminViolationEmail(violation, adminEmail) {
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">A new violation report requires attention.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
      <tr>
        <td style="padding:6px 0;width:120px;color:${COLORS.muted};font-size:13px;">Plate Number</td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;">${violation.extractedPlateNumber || "Not extracted"}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;">AI Confidence</td>
        <td style="padding:6px 0;font-size:13px;">${((violation.aiConfidence || 0) * 100).toFixed(1)}%</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;">Location</td>
        <td style="padding:6px 0;font-size:13px;">${fmtCoords(violation.location)}</td>
      </tr>
    </table>
    <a href="${env.CLIENT_ORIGIN}/admin/violations/${violation._id}"
       style="display:inline-block;background:${COLORS.blue};color:${COLORS.onBrand};font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;text-decoration:none;">
      View in Dashboard
    </a>
  `;

  return sendMail({
    to: adminEmail,
    subject: `New violation detected — Plate ${violation.extractedPlateNumber || "UNKNOWN"}`,
    html: wrapEmail({
      preheader: "A new violation report requires admin review.",
      eyebrow: "Admin Notification",
      title: "New Violation Report Submitted",
      bodyHtml,
      referenceId: violation._id.toString(),
      accent: "blue",
    }),
  });
}

// ------------------------------------------------------------------
// Auth / account
// ------------------------------------------------------------------

async function sendOtpEmail(user, code) {
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${user.fullName},</p>
    <p style="margin:0 0 20px 0;">Use the code below to sign in to your CIVIMAP account. This code expires in 5 minutes.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:18px 0;background:${COLORS.surface2};border:1px solid ${COLORS.border};border-radius:8px;">
          <span style="font-size:30px;font-weight:700;letter-spacing:0.3em;color:${COLORS.text};">${code}</span>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0 0;font-size:13px;color:${COLORS.muted};">Didn't request this code? You can safely ignore this email.</p>
  `;

  return sendMail({
    to: user.email,
    subject: `Your CIVIMAP login code: ${code}`,
    html: wrapEmail({
      preheader: `Your CIVIMAP login code is ${code}.`,
      eyebrow: "Account Login",
      title: "Your One-Time Login Code",
      bodyHtml,
      accent: "blue",
    }),
  });
}

async function sendVerificationEmail(user, rawToken) {
  const link = `${env.CLIENT_ORIGIN}/verify-email?token=${rawToken}`;
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${user.fullName},</p>
    <p style="margin:0 0 20px 0;">Please confirm your email address to finish setting up your CIVIMAP account.</p>
    <a href="${link}" style="display:inline-block;background:${COLORS.crimson};color:${COLORS.onBrand};font-size:13px;font-weight:600;padding:10px 22px;border-radius:6px;text-decoration:none;">
      Verify Email Address
    </a>
    <p style="margin:20px 0 0 0;font-size:12px;color:${COLORS.muted};word-break:break-all;">
      Or copy this link: <a href="${link}" style="color:${COLORS.blue};">${link}</a>
    </p>
  `;

  return sendMail({
    to: user.email,
    subject: "Verify your CIVIMAP account",
    html: wrapEmail({
      preheader: "Please verify your email to finish setting up your account.",
      eyebrow: "Account Verification",
      title: "Verify Your Email Address",
      bodyHtml,
      accent: "crimson",
    }),
  });
}

async function sendPasswordResetEmail(user, rawToken) {
  const link = `${env.CLIENT_ORIGIN}/reset-password?token=${rawToken}`;
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">We received a request to reset your CIVIMAP account password.</p>
    <a href="${link}" style="display:inline-block;background:${COLORS.crimson};color:${COLORS.onBrand};font-size:13px;font-weight:600;padding:10px 22px;border-radius:6px;text-decoration:none;">
      Reset Password
    </a>
    <p style="margin:20px 0 0 0;font-size:13px;color:${COLORS.muted};">This link is valid for 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `;

  return sendMail({
    to: user.email,
    subject: "Reset your CIVIMAP password",
    html: wrapEmail({
      preheader: "Reset your CIVIMAP account password.",
      eyebrow: "Account Security",
      title: "Reset Your Password",
      bodyHtml,
      accent: "crimson",
    }),
  });
}

// ------------------------------------------------------------------
// Reports
// ------------------------------------------------------------------

async function sendReportStatusEmail(report, user) {
  const statusLabel = report.status === "approved" ? "approved" : "rejected";
  const accent = report.status === "approved" ? "green" : "crimson";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${user.fullName},</p>
    <p style="margin:0 0 16px 0;">
      Your report submitted on ${report.createdAt.toLocaleDateString()} has been
      <strong style="color:${accent === "green" ? COLORS.green : COLORS.crimson};">${statusLabel}</strong>.
    </p>
    ${report.rejectionReason ? `<p style="margin:0;font-size:13px;color:${COLORS.muted};">Reason: ${report.rejectionReason}</p>` : ""}
  `;

  return sendMail({
    to: user.email,
    subject: `Your road issue report was ${statusLabel}`,
    html: wrapEmail({
      preheader: `Your report was ${statusLabel}.`,
      eyebrow: "Report Status Update",
      title: `Your Report Has Been ${statusLabel[0].toUpperCase()}${statusLabel.slice(1)}`,
      bodyHtml,
      referenceId: report._id.toString(),
      accent,
    }),
  });
}

// ------------------------------------------------------------------
// Emergency
// ------------------------------------------------------------------

async function sendDepartmentEmergencyEmail(alert, contact, citizen) {
  if (!contact.email) return { success: false, error: "No department email" };

  const mapsLink = `https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      <strong>${citizen.fullName}</strong> (${citizen.phone}) has reported a
      <strong>${alert.category}</strong> emergency requiring immediate attention.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="padding:6px 0;width:100px;color:${COLORS.muted};font-size:13px;">Location</td>
        <td style="padding:6px 0;font-size:13px;"><a href="${mapsLink}" style="color:${COLORS.blue};text-decoration:none;">${mapsLink}</a></td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;">Reported At</td>
        <td style="padding:6px 0;font-size:13px;">${alert.dispatchedAt.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;vertical-align:top;">Note</td>
        <td style="padding:6px 0;font-size:13px;">${alert.note || "No additional details provided"}</td>
      </tr>
    </table>
  `;

  return sendMail({
    to: contact.email,
    subject: `CIVIMAP Emergency Alert — ${alert.category}`,
    html: wrapEmail({
      preheader: `Emergency alert: ${alert.category} reported by ${citizen.fullName}.`,
      eyebrow: "Emergency Alert",
      title: `${alert.category[0].toUpperCase()}${alert.category.slice(1)} Emergency Reported`,
      bodyHtml,
      referenceId: alert._id.toString(),
      accent: "crimson",
    }),
  });
}

module.exports = {
  sendOwnerViolationEmail,
  sendAdminViolationEmail,
  sendReportStatusEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOtpEmail,
  sendDepartmentEmergencyEmail,
};