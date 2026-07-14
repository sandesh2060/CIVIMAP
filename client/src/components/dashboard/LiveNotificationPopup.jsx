// file: client/src/components/dashboard/LiveNotificationPopup.jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "../../hooks/useNotifications";
import { useAuth } from "../../context/AuthContext";
import { EASE } from "../../config/tokens";

// Keep in sync with Notification.type values (server/src/models/Notification.js).
// eyebrow/eyebrowNe mirror the language pairs already used in
// server/src/notifications/emailService.js's VIOLATION_STRINGS /
// BROADCAST_STRINGS, so the same event reads with the same wording
// whether it arrives by email or in-app.
const TYPE_META = {
  admin_broadcast: {
    eyebrow: "Official Announcement",
    eyebrowNe: "आधिकारिक सूचना",
    accentVar: "--np-blue",
    softVar: "--blue-soft",
    softFallback: "rgba(0,56,147,0.1)",
    icon: (
      <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zM14 8a4 4 0 010 8M17 5a8 8 0 010 14" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  report_status: {
    eyebrow: "Report Status Update",
    eyebrowNe: "प्रतिवेदन स्थिति अद्यावधिक",
    accentVar: "--np-blue",
    softVar: "--blue-soft",
    softFallback: "rgba(0,56,147,0.1)",
    icon: (
      <>
        <path d="M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="5" y="6" width="14" height="15" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h4" strokeLinecap="round" />
      </>
    ),
  },
  violation_status: {
    eyebrow: "Traffic Violation Notice",
    eyebrowNe: "ट्राफिक उल्लङ्घन सूचना",
    accentVar: "--np-crimson",
    softVar: "--crimson-soft",
    softFallback: "rgba(220,20,60,0.1)",
    icon: <path d="M12 3l9 16H3l9-16zM12 10v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />,
  },
  violation_matched: {
    eyebrow: "Traffic Violation Notice",
    eyebrowNe: "ट्राफिक उल्लङ्घन सूचना",
    accentVar: "--np-crimson",
    softVar: "--crimson-soft",
    softFallback: "rgba(220,20,60,0.1)",
    icon: (
      <>
        <path d="M4 16l1.5-5A2 2 0 017.4 9.5h9.2a2 2 0 011.9 1.5L20 16" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="16" width="18" height="4" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7.5" cy="20.5" r="1.2" />
        <circle cx="16.5" cy="20.5" r="1.2" />
      </>
    ),
  },
};
const DEFAULT_META = {
  eyebrow: "Notice",
  eyebrowNe: "सूचना",
  accentVar: "--np-blue",
  softVar: "--blue-soft",
  softFallback: "rgba(0,56,147,0.1)",
  icon: (
    <path d="M12 3a5 5 0 00-5 5v3.5c0 .8-.3 1.5-.9 2.1L5 15h14l-1.1-1.4a3 3 0 01-.9-2.1V8a5 5 0 00-5-5zM9.5 18a2.5 2.5 0 005 0" strokeLinecap="round" strokeLinejoin="round" />
  ),
};

function isNepali(user) {
  return user?.languagePref === "ne";
}

// Guards against "Invalid Date" — if createdAt is missing or unparsable
// (e.g. a socket payload that hasn't hydrated it yet), fall back to "now"
// instead of rendering a broken string.
function safeDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatTimestampEn(dateStr) {
  return safeDate(dateStr).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDateNe(dateStr) {
  return safeDate(dateStr).toLocaleDateString("ne-NP", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// Mount this once, high in the tree (see DashboardLayout below), so any
// notification pushed live over the socket — e.g. "your vehicle was
// reported" — pops up as a formal notice the instant it arrives, on
// whatever page the citizen currently has open. No reload, no waiting
// for the next dashboard mount.
//
// Renders two distinct layouts depending on the viewer's languagePref:
//  - "en": a compact letterhead mirroring wrapEmail() in emailService.js
//    (crest header, tricolor rule, centered eyebrow+title, reference box)
//  - "ne": a formal Nepali chitthi (सूचनापत्र) — dated top-right, subject
//    line, salutation, body, closing signature block — instead of a
//    literal translation of the English layout, since a government notice
//    in Nepali follows its own letter conventions, not the English one.
// Falls back to English if titleNe/messageNe weren't authored for a
// given notification (only admin_broadcast supports them right now).
//
// Note: this can occasionally show alongside FirstLoginNotificationModal
// if a live event fires in the same instant the dashboard mounts — that
// overlap is harmless (both just call markRead/markAllRead) and rare in
// practice, since FirstLoginNotificationModal only fires once per browser
// session on initial load.
export default function LiveNotificationPopup() {
  const { user } = useAuth();
  const { incoming, clearIncoming, markRead } = useNotifications();
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    if (!incoming) return;
    setVisible({
      _id: incoming._id,
      type: incoming.type,
      title: incoming.title,
      message: incoming.message,
      titleNe: incoming.titleNe || null,
      messageNe: incoming.messageNe || null,
      createdAt: incoming.createdAt,
    });
  }, [incoming]);

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleClose() {
    if (visible?._id) markRead(visible._id);
    setVisible(null);
    clearIncoming();
  }

  if (!visible) return <AnimatePresence />;

  const meta = TYPE_META[visible.type] || DEFAULT_META;
  const accent = `var(${meta.accentVar})`;
  const soft = `var(${meta.softVar}, ${meta.softFallback})`;

  // Only render Nepali if this notification actually has Nepali copy —
  // otherwise fall back to English even for a Nepali-preferring viewer.
  const useNe = isNepali(user) && visible.titleNe && visible.messageNe;
  const title = useNe ? visible.titleNe : visible.title;
  const message = useNe ? visible.messageNe : visible.message;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE.out }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        >
          {useNe ? (
            <ChitthiBody
              title={title}
              message={message}
              eyebrowNe={meta.eyebrowNe}
              accent={accent}
              soft={soft}
              icon={meta.icon}
              createdAt={visible.createdAt}
              referenceId={visible._id}
              onClose={handleClose}
            />
          ) : (
            <LetterheadBody
              title={title}
              message={message}
              eyebrow={meta.eyebrow}
              accent={accent}
              soft={soft}
              icon={meta.icon}
              createdAt={visible.createdAt}
              referenceId={visible._id}
              onClose={handleClose}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------
// English — compact letterhead, mirrors wrapEmail()'s structure.
// ------------------------------------------------------------------
function LetterheadBody({ title, message, eyebrow, accent, soft, icon, createdAt, referenceId, onClose }) {
  return (
    <>
      <div className="px-6 pt-5 pb-4 border-b border-border flex items-center gap-3">
        <img
          src="/logo.jpg"
          alt="CiviMap"
          className="w-8 h-8 rounded-md object-cover shrink-0"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-display font-bold text-text tracking-tight">CIVIMAP</div>
          <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">
            Nepal National Problem &amp; Traffic Reporting Platform
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-7 h-7 grid place-items-center rounded-md text-muted hover:bg-surface2 transition"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="h-1 flex shrink-0">
        <span className="flex-1" style={{ background: "var(--np-crimson)" }} />
        <span className="flex-1" style={{ background: "var(--np-blue)" }} />
        <span className="flex-1" style={{ background: "var(--np-gold, #C89B3C)" }} />
      </div>

      <div className="px-6 pt-6 pb-2 text-center">
        <span
          className="inline-flex w-12 h-12 rounded-full items-center justify-center mb-3"
          style={{ background: soft, color: accent }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            {icon}
          </svg>
        </span>
        <div className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: accent }}>
          {eyebrow}
        </div>
        <h3 className="font-display font-bold text-lg text-text leading-snug">{title}</h3>
      </div>

      <div className="px-6 pb-5 pt-2 text-left">
        <p className="text-sm text-text leading-relaxed">{message}</p>
      </div>

      {referenceId && (
        <div className="px-6 pb-4">
          <div className="bg-surface2 border border-border rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-faint">Reference</span>
            <span className="text-[11px] font-mono text-muted truncate">{referenceId}</span>
          </div>
        </div>
      )}

      <div className="px-6 pt-3 pb-4 border-t border-border bg-surface2">
        <p className="text-[11px] text-faint">{formatTimestampEn(createdAt)}</p>
        <p className="text-[10px] text-faint leading-relaxed mt-1.5">
          This is an automated notice from the CiviMap citizen reporting platform.
        </p>
      </div>

      <div className="px-6 pb-5 flex justify-end">
        <button
          onClick={onClose}
          className="px-5 h-9 rounded-lg text-xs font-medium text-white transition"
          style={{ background: "var(--np-blue)" }}
        >
          Close
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Nepali — formal chitthi (सूचनापत्र): letterhead crest, dated line,
// subject, salutation, body, closing signature. Follows Nepali official
// letter convention rather than mirroring the English layout literally.
// ------------------------------------------------------------------
function ChitthiBody({ title, message, eyebrowNe, accent, soft, icon, createdAt, referenceId, onClose }) {
  return (
    <>
      <div className="px-6 pt-5 pb-3 border-b border-border flex items-center gap-3">
        <img
          src="/logo.jpg"
          alt="सिभिम्याप"
          className="w-8 h-8 rounded-md object-cover shrink-0"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-display font-bold text-text tracking-tight">सिभिम्याप</div>
          <div className="text-[10px] text-muted mt-0.5">
            नेपाल राष्ट्रिय समस्या तथा ट्राफिक रिपोर्टिङ प्लेटफर्म
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="बन्द गर्नुहोस्"
          className="shrink-0 w-7 h-7 grid place-items-center rounded-md text-muted hover:bg-surface2 transition"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="h-1 flex shrink-0">
        <span className="flex-1" style={{ background: "var(--np-crimson)" }} />
        <span className="flex-1" style={{ background: "var(--np-blue)" }} />
        <span className="flex-1" style={{ background: "var(--np-gold, #C89B3C)" }} />
      </div>

      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <span
            className="inline-flex w-9 h-9 rounded-full items-center justify-center"
            style={{ background: soft, color: accent }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              {icon}
            </svg>
          </span>
          <span className="text-xs text-muted">{formatDateNe(createdAt)}</span>
        </div>

        <div className="mt-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
          {eyebrowNe}
        </div>

        <p className="text-xs text-muted mt-3">
          <span className="font-semibold text-text">विषय:</span> {title}
        </p>
      </div>

      <div className="px-6 pb-4 pt-2 text-left">
        <p className="text-sm text-text mb-3">श्री सम्मानित नागरिकज्यू,</p>
        <p className="text-sm text-text leading-relaxed">{message}</p>

        <div className="mt-5 text-sm text-text">
          <p>भवदीय,</p>
          <p className="font-semibold mt-0.5">सिभिम्याप प्रशासन</p>
        </div>
      </div>

      {referenceId && (
        <div className="px-6 pb-4">
          <div className="bg-surface2 border border-border rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-faint">सन्दर्भ नम्बर</span>
            <span className="text-[11px] font-mono text-muted truncate">{referenceId}</span>
          </div>
        </div>
      )}

      <div className="px-6 pt-3 pb-4 border-t border-border bg-surface2">
        <p className="text-[10px] text-faint leading-relaxed">
          यो सूचना सिभिम्याप नागरिक रिपोर्टिङ प्लेटफर्मबाट स्वचालित रूपमा पठाइएको हो।
        </p>
      </div>

      <div className="px-6 pb-5 flex justify-end">
        <button
          onClick={onClose}
          className="px-5 h-9 rounded-lg text-xs font-medium text-white transition"
          style={{ background: "var(--np-blue)" }}
        >
          बन्द गर्नुहोस्
        </button>
      </div>
    </>
  );
}