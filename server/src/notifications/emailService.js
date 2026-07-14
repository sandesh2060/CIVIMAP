// ========================================================================
// FILE : server/src/notifications/emailService.js
// All templates now render through wrapEmail() below — a shared,
// letterhead-style HTML shell using CIVIMAP's actual palette (see
// client/src/config/tokens.js COLORS — hex values hardcoded here on
// purpose, since email clients do not support CSS custom properties or
// backdrop-filter/box-shadow the way browsers do).
//
// Language: wrapEmail() and the OTP / violation-owner templates accept a
// `lang` ("en" | "ne") and render fully localized copy. sendOtpEmail()
// reads it straight off the User doc (languagePref). Violation owners are
// registry entries, not always CiviMap accounts, so
// sendOwnerViolationEmail() takes an explicit `language` param — pass the
// matched owner's languagePref if you have it (e.g. via a populated
// matchedOwnerUserId), otherwise it falls back to "en".
// ========================================================================

const { sendMail } = require("../utils/email");
const { env } = require("../config/env");

// ---- Brand constants (mirrors client/src/config/tokens.js COLORS) ----
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

// ------------------------------------------------------------------
// Shared chrome strings (letterhead subtitle, footer disclaimer,
// "Reference" label) — localized. Per-template copy (OTP / violation)
// lives in its own STRINGS block further down.
// ------------------------------------------------------------------
const CHROME = {
  en: {
    tagline: "Nepal National Problem & Traffic Reporting Platform",
    reference: "Reference",
    disclaimer:
      "This is an automated notice issued by the CIVIMAP citizen reporting platform on behalf of local traffic authorities. Do not reply directly to this email. If you believe this notice was issued in error, please contact your local traffic office and reference the ID above.",
  },
  ne: {
    tagline: "नेपाल राष्ट्रिय समस्या तथा ट्राफिक रिपोर्टिङ प्लेटफर्म",
    reference: "सन्दर्भ नम्बर",
    disclaimer:
      "यो सूचना सिभिम्याप नागरिक रिपोर्टिङ प्लेटफर्मबाट स्थानीय ट्राफिक निकायको तर्फबाट स्वचालित रूपमा पठाइएको हो। कृपया यो इमेलको सिधै जवाफ नदिनुहोस्। यदि तपाईंलाई लाग्छ कि यो सूचना गल्तीले जारी भएको छ भने, कृपया माथिको सन्दर्भ नम्बर उल्लेख गर्दै आफ्नो स्थानीय ट्राफिक कार्यालयमा सम्पर्क गर्नुहोस्।",
  },
};

function safeLang(lang) {
  return lang === "ne" ? "ne" : "en";
}

/**
 * Minimal circular icon badge rendered with a Unicode glyph instead of an
 * external image — keeps the letter feeling official without depending on
 * image-blocking-prone <img> tags for something this small.
 */
function iconBadge(glyph, { bg, color }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;">
      <tr>
        <td width="56" height="56" align="center" valign="middle"
            style="width:56px;height:56px;border-radius:50%;background:${bg};font-size:26px;line-height:56px;text-align:center;">
          ${glyph}
        </td>
      </tr>
    </table>`;
}

/**
 * Shared letterhead shell for every CIVIMAP email. Mimics an official
 * government notice: crest + title band, a thin tricolor rule, a plain
 * "letter" body area, and a formal footer with a reference/ID line.
 *
 * @param {Object} opts
 * @param {"en"|"ne"} [opts.lang="en"]
 * @param {string} opts.preheader - hidden preview text (inbox summary)
 * @param {string} opts.eyebrow - small caps label above the title
 * @param {string} opts.title - main heading
 * @param {string} [opts.iconGlyph] - optional Unicode glyph shown in a circular badge above the title
 * @param {string} opts.bodyHtml - the letter content (already-safe HTML)
 * @param {string} [opts.referenceId] - shown in the footer as "Reference: ..."
 * @param {"crimson"|"blue"|"green"} [opts.accent="crimson"] - band/eyebrow/badge accent
 */
function wrapEmail({
  lang = "en",
  preheader,
  eyebrow,
  title,
  iconGlyph,
  bodyHtml,
  referenceId,
  accent = "crimson",
}) {
  const L = safeLang(lang);
  const chrome = CHROME[L];
  const dir = "ltr"; // Nepali (Devanagari) is LTR, no rtl needed
  const accentColor =
    accent === "blue" ? COLORS.blue : accent === "green" ? COLORS.green : COLORS.crimson;
  const accentSoft =
    accent === "blue" ? COLORS.blueSoft : accent === "green" ? "#E7F3EA" : COLORS.crimsonSoft;

  return `
<!DOCTYPE html>
<html lang="${L}" dir="${dir}">
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
                    <div style="font-size:11px;color:${COLORS.muted};letter-spacing:0.06em;text-transform:uppercase;margin-top:1px;">${chrome.tagline}</div>
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

          <!-- icon + eyebrow + title -->
          <tr>
            <td style="padding:28px 32px 4px 32px;text-align:center;">
              ${iconGlyph ? iconBadge(iconGlyph, { bg: accentSoft, color: accentColor }) : ""}
              ${eyebrow ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${accentColor};margin-bottom:8px;">${eyebrow}</div>` : ""}
              <div style="font-size:20px;font-weight:700;color:${COLORS.text};line-height:1.3;">${title}</div>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td style="padding:12px 32px 28px 32px;font-size:14px;line-height:1.65;color:${COLORS.text};text-align:left;">
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
                          <span style="text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:${COLORS.faint};">${chrome.reference}</span>
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
                ${chrome.disclaimer}
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

const VIOLATION_STRINGS = {
  en: {
    eyebrow: "Traffic Violation Notice",
    title: "Notice of Recorded Traffic Violation",
    greeting: (name) => `Dear ${name},`,
    intro: (plate) =>
      `A traffic violation has been recorded against a vehicle registered to you, bearing plate number <strong>${plate}</strong>. Details are provided below for your reference.`,
    plateLabel: "Plate Number",
    dateLabel: "Date &amp; Time",
    locationLabel: "Location",
    viewOnMap: "View on map",
    closing:
      "If you believe this notice has been issued in error, please contact the traffic authority and quote the reference number below.",
    subject: (plate) => `Traffic Violation Notice — Plate ${plate}`,
    preheader: (plate) => `A traffic violation was recorded for plate ${plate}.`,
  },
  ne: {
    eyebrow: "ट्राफिक उल्लङ्घन सूचना",
    title: "दर्ता गरिएको ट्राफिक उल्लङ्घनको सूचना",
    greeting: (name) => `प्रिय ${name},`,
    intro: (plate) =>
      `तपाईंको नाममा दर्ता भएको सवारी साधन, नम्बर प्लेट <strong>${plate}</strong> विरुद्ध ट्राफिक उल्लङ्घन दर्ता गरिएको छ। विवरण तल उल्लेख गरिएको छ।`,
    plateLabel: "नम्बर प्लेट",
    dateLabel: "मिति र समय",
    locationLabel: "स्थान",
    viewOnMap: "नक्सामा हेर्नुहोस्",
    closing:
      "यदि तपाईंलाई लाग्छ कि यो सूचना गल्तीले जारी भएको छ भने, कृपया तलको सन्दर्भ नम्बर उल्लेख गर्दै ट्राफिक निकायमा सम्पर्क गर्नुहोस्।",
    subject: (plate) => `ट्राफिक उल्लङ्घन सूचना — प्लेट ${plate}`,
    preheader: (plate) => `प्लेट ${plate} का लागि ट्राफिक उल्लङ्घन दर्ता गरिएको छ।`,
  },
};

/**
 * @param {Object} violation - Violation document (matchedOwner populated)
 * @param {"en"|"ne"} [language="en"] - pass the owner's languagePref if
 *   known (e.g. via a populated matchedOwnerUserId); registry-only owners
 *   have no language field, so this defaults to English.
 */
async function sendOwnerViolationEmail(violation, language = "en") {
  if (!violation.matchedOwner?.email) return { success: false, error: "No owner email" };

  const L = safeLang(language);
  const S = VIOLATION_STRINGS[L];
  const mapsLink = mapsLinkFromPoint(violation.location);
  const ownerName = violation.matchedOwner.name || (L === "ne" ? "सवारी मालिक" : "Vehicle Owner");

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">${S.greeting(ownerName)}</p>
    <p style="margin:0 0 16px 0;">${S.intro(violation.extractedPlateNumber)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="padding:6px 0;width:130px;color:${COLORS.muted};font-size:13px;vertical-align:top;">${S.plateLabel}</td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;">${violation.extractedPlateNumber}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;vertical-align:top;">${S.dateLabel}</td>
        <td style="padding:6px 0;font-size:13px;">${violation.createdAt.toLocaleString(L === "ne" ? "ne-NP" : "en-US")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;vertical-align:top;">${S.locationLabel}</td>
        <td style="padding:6px 0;font-size:13px;">
          ${fmtCoords(violation.location)} &nbsp;·&nbsp;
          <a href="${mapsLink}" style="color:${COLORS.blue};text-decoration:none;">${S.viewOnMap}</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;">${S.closing}</p>
  `;

  return sendMail({
    to: violation.matchedOwner.email,
    subject: S.subject(violation.extractedPlateNumber),
    html: wrapEmail({
      lang: L,
      preheader: S.preheader(violation.extractedPlateNumber),
      eyebrow: S.eyebrow,
      title: S.title,
      iconGlyph: "🚨",
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
      lang: "en",
      preheader: "A new violation report requires admin review.",
      eyebrow: "Admin Notification",
      title: "New Violation Report Submitted",
      iconGlyph: "🚨",
      bodyHtml,
      referenceId: violation._id.toString(),
      accent: "blue",
    }),
  });
}

// ------------------------------------------------------------------
// Auth / account
// ------------------------------------------------------------------

const OTP_STRINGS = {
  en: {
    eyebrow: "Account Login",
    title: "Your One-Time Login Code",
    greeting: (name) => `Hi ${name},`,
    body: "Use the code below to sign in to your CiviMap account. This code will expire in 5 minutes.",
    expiresLabel: "Expires in 5 minutes",
    footerNote: "Didn't request this code? You can safely ignore this email.",
    subject: (code) => `Your CiviMap login code: ${code}`,
    preheader: (code) => `Your CiviMap login code is ${code}.`,
  },
  ne: {
    eyebrow: "खाता लगइन",
    title: "तपाईंको एकपटके लगइन कोड",
    greeting: (name) => `नमस्ते ${name},`,
    body: "आफ्नो सिभिम्याप खातामा साइन इन गर्न तलको कोड प्रयोग गर्नुहोस्। यो कोड ५ मिनेटमा समाप्त हुनेछ।",
    expiresLabel: "५ मिनेटमा समाप्त हुन्छ",
    footerNote: "यो कोड तपाईंले अनुरोध गर्नुभएको होइन? तपाईं यो इमेललाई सुरक्षित रूपमा बेवास्ता गर्न सक्नुहुन्छ।",
    subject: (code) => `तपाईंको सिभिम्याप लगइन कोड: ${code}`,
    preheader: (code) => `तपाईंको सिभिम्याप लगइन कोड ${code} हो।`,
  },
};
async function sendOtpEmail(user, code, lang) {
  // Explicit lang (from the live UI toggle, via authController → otpService)
  // wins when present; otherwise fall back to the account's saved
  // languagePref, then finally "en".
  const L = safeLang(lang ?? user.languagePref);
  const S = OTP_STRINGS[L];

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">${S.greeting(user.fullName)}</p>
    <p style="margin:0 0 20px 0;">${S.body}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:18px 0;background:${COLORS.surface2};border:1px solid ${COLORS.border};border-radius:8px;">
          <span style="font-size:30px;font-weight:700;letter-spacing:0.3em;color:${COLORS.text};">${code}</span>
        </td>
      </tr>
    </table>
    <p style="margin:10px 0 0 0;font-size:12px;color:${COLORS.faint};text-align:center;">${S.expiresLabel}</p>
    <p style="margin:20px 0 0 0;font-size:13px;color:${COLORS.muted};">${S.footerNote}</p>
  `;

  return sendMail({
    to: user.email,
    subject: S.subject(code),
    html: wrapEmail({
      lang: L,
      preheader: S.preheader(code),
      eyebrow: S.eyebrow,
      title: S.title,
      iconGlyph: "🔐",
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
      lang: "en",
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
      lang: "en",
      preheader: "Reset your CIVIMAP account password.",
      eyebrow: "Account Security",
      title: "Reset Your Password",
      bodyHtml,
      accent: "crimson",
    }),
  });
}
// server/src/notifications/emailService.js — add this block, then export it

const BROADCAST_STRINGS = {
  en: {
    eyebrow: "Official Announcement",
    closing: "This announcement was sent by a CiviMap administrator.",
  },
  ne: {
    eyebrow: "आधिकारिक सूचना",
    closing: "यो सूचना सिभिम्याप प्रशासकबाट पठाइएको हो।",
  },
};

async function sendBroadcastEmail(recipient, { title, message }, language = "en") {
  if (!recipient?.email) return { success: false, error: "No recipient email" };

  const L = safeLang(language ?? recipient.languagePref);
  const S = BROADCAST_STRINGS[L];
  const name = recipient.fullName || (L === "ne" ? "प्रयोगकर्ता" : "there");

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">${L === "ne" ? `नमस्ते ${name},` : `Hi ${name},`}</p>
    <p style="margin:0 0 12px 0;font-weight:600;font-size:15px;">${title}</p>
    <p style="margin:0 0 16px 0;">${message}</p>
    <p style="margin:0;font-size:12px;color:${COLORS.muted};">${S.closing}</p>
  `;

  return sendMail({
    to: recipient.email,
    subject: title,
    html: wrapEmail({
      lang: L,
      preheader: title,
      eyebrow: S.eyebrow,
      title,
      iconGlyph: "📢",
      bodyHtml,
      accent: "blue",
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
      lang: "en",
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

const EMERGENCY_CATEGORY_META = {
  ambulance: { icon: "🚑", accent: "crimson", label: "Ambulance" },
  fire:      { icon: "🔥", accent: "crimson", label: "Fire" },
  police:    { icon: "🚓", accent: "blue",    label: "Police" },
  rescue:    { icon: "🛟", accent: "green",   label: "Rescue" },
};

async function sendDepartmentEmergencyEmail(alert, contact, citizen) {
  if (!contact.email) return { success: false, error: "No department email" };

  const meta = EMERGENCY_CATEGORY_META[alert.category] || {
    icon: "🚨",
    accent: "crimson",
    label: alert.category,
  };

  const mapsLink = `https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">
      <strong>${citizen.fullName}</strong> (${citizen.phone}) has reported a
      <strong>${meta.label}</strong> emergency requiring immediate attention.
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
    subject: `CIVIMAP Emergency Alert — ${meta.label}`,
    html: wrapEmail({
      lang: "en",
      preheader: `Emergency alert: ${meta.label} reported by ${citizen.fullName}.`,
      eyebrow: "Emergency Alert",
      title: `${meta.label} Emergency Reported`,
      iconGlyph: meta.icon,
      bodyHtml,
      referenceId: alert._id.toString(),
      accent: meta.accent,
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
  sendBroadcastEmail,
  sendDepartmentEmergencyEmail,
};