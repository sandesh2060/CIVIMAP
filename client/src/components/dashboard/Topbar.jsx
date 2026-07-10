// file: client/src/components/dashboard/Topbar.jsx
import { useLang } from "../../i18n/LanguageContext";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../context/AuthContext";

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

export default function Topbar({ onMenu, title }) {
  const { t, lang, toggleLang } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface/85 backdrop-blur
                       flex items-center gap-3 px-4 sticky top-0 z-30">
      <button onClick={onMenu} aria-label={t("dash.menu")}
              className="md:hidden w-10 h-10 grid place-items-center rounded-lg hover:bg-surface2 transition">
        <I d="M4 6h16M4 12h16M4 18h16" />
      </button>

      <h1 className="font-display font-semibold text-lg truncate">{title}</h1>

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

      <button onClick={toggleLang}
              className="h-10 px-3 rounded-lg hover:bg-surface2 transition font-medium text-sm shrink-0 text-muted hover:text-text">
        {lang === "en" ? "ने" : "EN"}
      </button>

      <div className="w-9 h-9 rounded-full overflow-hidden grid place-items-center shrink-0"
           style={{ background: "var(--np-blue)" }}
           title={user?.name || ""}>
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-sm font-medium">{getInitials(user?.name)}</span>
        )}
      </div>
    </header>
  );
}