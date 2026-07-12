// file: client/src/components/ui/Toast.jsx
import LiquidGlass from "../LiquidGlass";
import { useLang } from "../../i18n/LanguageContext";

// A single-message glass alert modal — deliberately matches the visual
// language of FirstLoginNotificationModal (centered, blurred backdrop,
// LiquidGlass card) rather than a corner snackbar. An outcome like a
// rejected self-report is something the citizen needs to actually see
// and acknowledge, not a toast that can be missed while scrolling.
//
// toast: null | { type: "error" | "success" | "info", message, title? }
export default function Toast({ toast, onClose }) {
  const { t } = useLang();
  if (!toast) return null;

  const accentVar =
    toast.type === "error"
      ? "var(--np-crimson)"
      : toast.type === "success"
      ? "var(--np-green)"
      : "var(--np-blue)";

  const softVar =
    toast.type === "error"
      ? "var(--crimson-soft)"
      : toast.type === "success"
      ? "var(--green-soft)"
      : "var(--blue-soft)";

  const title =
    toast.title ??
    (toast.type === "error"
      ? t("common.error")
      : toast.type === "success"
      ? t("common.success")
      : t("common.notice"));

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <LiquidGlass
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5 flex gap-3 items-start">
          <span
            className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: softVar }}
          >
            {toast.type === "error" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentVar} strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : toast.type === "success" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentVar} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentVar} strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="8" x2="12" y2="8.01" />
                <line x1="12" y1="11" x2="12" y2="16" />
              </svg>
            )}
          </span>
          <div className="flex-1 pt-1">
            <h2 className="font-display font-semibold text-base text-text">{title}</h2>
            <p className="text-sm text-muted mt-1 leading-snug">{toast.message}</p>
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition"
            style={{ background: accentVar }}
          >
            {t("reports.close")}
          </button>
        </div>
      </LiquidGlass>
    </div>
  );
}