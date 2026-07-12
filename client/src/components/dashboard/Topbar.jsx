// file: client/src/components/dashboard/Topbar.jsx
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "./NotificationBell";

const I = ({ d, children, ...r }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
       strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" {...r}>
    {d && <path d={d} />}{children}
  </svg>
);

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ---------------------------------------------------------------------- */
/*  Profile dropdown — avatar trigger, "Profile Settings" + "Log out"     */
/* ---------------------------------------------------------------------- */

function ProfileMenu({ user, t, onNavigate, onRequestLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-full overflow-hidden grid place-items-center shrink-0 transition ring-offset-2 ring-offset-surface hover:ring-2"
        style={{ background: "var(--np-blue)", "--tw-ring-color": "var(--np-blue)" }}
        title={user?.fullName || ""}
      >
        {user?.profileImage?.url ? (
          <img src={user.profileImage.url} alt={user.fullName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-sm font-medium">{getInitials(user?.fullName)}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="menu"
            className="absolute right-0 top-[calc(100%+10px)] w-56 rounded-xl overflow-hidden z-40 surface-card"
          >
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-[13.5px] font-medium text-text truncate">{user?.fullName || ""}</p>
              <p className="text-[12px] text-muted truncate mt-0.5">{user?.email || user?.phone || ""}</p>
            </div>

            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate?.("settings");
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] text-text hover:bg-surface2 transition text-left"
            >
              <I d="M12 15a3 3 0 100-6 3 3 0 000 6zm0 0v3m-7-3a7 7 0 1114 0 7 7 0 01-14 0z" className="w-4 h-4 text-muted" />
              {t("nav.settings")}
            </button>

            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onRequestLogout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13.5px] hover:bg-surface2 transition text-left"
              style={{ color: "var(--np-crimson)" }}
            >
              <I d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" className="w-4 h-4" />
              {t("nav.logout")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Logout confirmation — centered modal, blurred backdrop                */
/* ---------------------------------------------------------------------- */

function LogoutConfirmModal({ open, onCancel, onConfirm, loading, t }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(20,16,8,0.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-surface p-6"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <div className="w-11 h-11 rounded-full grid place-items-center mb-4" style={{ background: "var(--crimson-soft)" }}>
              <I d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" style={{ color: "var(--np-crimson)" }} />
            </div>
            <h3 className="font-display text-[17px] font-semibold text-text mb-1.5">{t("topbar.logoutConfirmTitle")}</h3>
            <p className="text-[13.5px] text-muted leading-relaxed mb-6">{t("topbar.logoutConfirmBody")}</p>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="lux-btn-secondary flex-1 h-10 rounded-lg text-[13.5px] font-medium disabled:opacity-60"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 h-10 rounded-lg text-[13.5px] font-medium text-white disabled:opacity-70"
                style={{ background: "var(--np-crimson)" }}
              >
                {loading ? t("settings.signingOut") : t("nav.logout")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------------- */
/*  Topbar                                                                 */
/* ---------------------------------------------------------------------- */

export default function Topbar({ onMenu, onNavigate }) {
  const { t, lang, toggleLang } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleConfirmLogout() {
    setLoggingOut(true);
    try {
      await logout?.();
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <header className="h-16 shrink-0 border-b border-border bg-surface/85 backdrop-blur
                         flex items-center gap-3 px-4 sticky top-0 z-30">
        <button onClick={onMenu} aria-label={t("dash.menu")}
                className="md:hidden w-10 h-10 grid place-items-center rounded-lg hover:bg-surface2 transition shrink-0">
          <I d="M4 6h16M4 12h16M4 18h16" />
        </button>

        {/* Nepal emblem + slogan — reuses the app's own branding assets/copy
            (public/logo.jpg, i18n appName/tagline) rather than new ones.
            object-contain (no rounded-full crop) so the emblem's full
            artwork shows instead of getting clipped into a circle. */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.jpg" alt="" className="w-10 h-10 object-contain shrink-0" />
          <div className="leading-none hidden sm:block">
            <p className="font-display text-[13.5px] font-semibold text-text">{t("appName")}</p>
            <p className="text-[10.5px] text-faint mt-0.5">{t("tagline")}</p>
          </div>
        </div>

        <div className="ml-auto hidden sm:flex items-center max-w-xs w-full">
          <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <I><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></I>
            </span>
            <input type="text" placeholder={t("dash.search")}
              className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface2 border border-transparent
                         focus:border-border focus:bg-surface outline-none transition text-sm" />
          </div>
        </div>

        <button onClick={toggleTheme} aria-label="Toggle theme"
                className="w-10 h-10 grid place-items-center rounded-lg hover:bg-surface2 transition shrink-0 text-muted hover:text-text">
          {theme === "dark"
            ? <I><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></I>
            : <I d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />}
        </button>

        <NotificationBell />

        <button onClick={toggleLang}
                className="h-10 px-3 rounded-lg hover:bg-surface2 transition font-medium text-sm shrink-0 text-muted hover:text-text">
          {lang === "en" ? "ने" : "EN"}
        </button>

        <ProfileMenu
          user={user}
          t={t}
          onNavigate={onNavigate}
          onRequestLogout={() => setConfirmOpen(true)}
        />
      </header>

      <LogoutConfirmModal
        open={confirmOpen}
        loading={loggingOut}
        onCancel={() => !loggingOut && setConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        t={t}
      />
    </>
  );
}