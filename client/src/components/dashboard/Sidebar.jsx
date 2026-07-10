// file: client/src/components/dashboard/Sidebar.jsx
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../i18n/LanguageContext";
import { useAuth } from "../../context/AuthContext";

/* SVG icon set (stroke-based, inherits currentColor) */
const Icon = ({ name }) => {
  const p = {
    overview: "M3 12l2-2 7-7 7 7 2 2M5 10v10a1 1 0 001 1h3m10-11v11a1 1 0 01-1 1h-3m-6 0h6m-6 0v-5a1 1 0 011-1h2a1 1 0 011 1v5",
    reports: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    map: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13 6-3m-6 3V7m6 10 4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    analytics: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    emergency: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zM12 7v5M12 15h.01",
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <path d={p[name] || p.overview} />
      {name === "settings" && <circle cx="12" cy="12" r="3" />}
    </svg>
  );
};

export default function Sidebar({ items, active, onSelect, expanded }) {
  const { t } = useLang();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const showLabel = expanded;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="h-full flex flex-col py-4">
      {/* brand */}
      <div className="px-4 mb-6 flex items-center gap-3 h-9">
        <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
             style={{ background: "var(--np-crimson)" }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#fff">
            <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
            <circle cx="12" cy="9" r="2.6" fill="var(--np-crimson)" />
          </svg>
        </div>
        <AnimatePresence>
          {showLabel && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.2 }}
              className="font-display font-bold text-lg text-crimson whitespace-nowrap"
            >
              CiviMap
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* nav items */}
      <ul className="flex-1 px-2 space-y-1">
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <li key={it.id}>
              <button
                onClick={() => onSelect(it.id)}
                title={t(it.labelKey)}
                className={`relative w-full flex items-center gap-3 px-3 h-11 rounded-lg
                  transition-colors duration-200
                  ${isActive ? "text-crimson" : "text-muted hover:text-text hover:bg-surface2"}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="active-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "var(--crimson-soft)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10"><Icon name={it.icon} /></span>
                <AnimatePresence>
                  {showLabel && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.18 }}
                      className="relative z-10 font-medium whitespace-nowrap"
                    >
                      {t(it.labelKey)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </li>
          );
        })}
      </ul>

      {/* logout */}
      <div className="px-2 pt-3 mt-2 border-t border-border">
        <button
          onClick={handleLogout}
          title={t("nav.logout")}
          className="w-full flex items-center gap-3 px-3 h-11 rounded-lg
                     text-muted hover:text-text hover:bg-surface2 transition-colors">
          <span className="shrink-0"><Icon name="logout" /></span>
          <AnimatePresence>
            {showLabel && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.18 }}
                className="font-medium whitespace-nowrap"
              >
                {t("nav.logout")}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </nav>
  );
}