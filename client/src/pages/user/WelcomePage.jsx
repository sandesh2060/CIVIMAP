import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";
import { useTheme } from "../../hooks/useTheme";
import { EASE, DUR } from "../../config/tokens";

function ArrowIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ShieldIcon(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6l-8-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SunIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M21 13.5A8.5 8.5 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- shared pill switch (language + theme use the same visual language) ---------- */

function LangSwitch({ lang, toggleLang }) {
  const [ripple, setRipple] = useState(null);

  function handleClick(code, e) {
    if (code === lang) return;
    const track = e.currentTarget.parentElement.getBoundingClientRect();
    setRipple({ x: e.clientX - track.left, y: e.clientY - track.top, id: Date.now() });
    toggleLang();
  }

  return (
    <div className="relative grid grid-cols-2 gap-3 mb-6">
      {["en", "ne"].map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={(e) => handleClick(code, e)}
            className="relative py-3 rounded-full text-sm font-semibold overflow-hidden transition-colors"
            style={{
              border: `1.5px solid ${active ? "var(--np-crimson)" : "var(--border)"}`,
              background: active ? "var(--crimson-soft)" : "var(--surface-2)",
              color: active ? "var(--np-crimson)" : "var(--text-muted)",
            }}
          >
            <AnimatePresence>
              {ripple && active && (
                <motion.span
                  key={ripple.id}
                  initial={{ opacity: 0.35, scale: 0 }}
                  animate={{ opacity: 0, scale: 10 }}
                  transition={{ duration: 0.55, ease: EASE.out }}
                  onAnimationComplete={() => setRipple(null)}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: ripple.x, top: ripple.y,
                    width: 8, height: 8, marginLeft: -4, marginTop: -4,
                    background: "var(--np-crimson)",
                  }}
                />
              )}
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={code + active}
                initial={active ? { opacity: 0, y: 3 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE.out }}
                className="relative z-10 inline-block"
              >
                {code === "en" ? "English" : "नेपाली"}
              </motion.span>
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

function ThemeSwitch({ theme, setThemeAnimated }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-8">
      {[
        { key: "light", label: "Light", Icon: SunIcon },
        { key: "dark", label: "Dark", Icon: MoonIcon },
      ].map(({ key, label, Icon }) => {
        const active = theme === key;
        return (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={(e) => setThemeAnimated(key, e)}
            className="py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            style={{
              border: `1.5px solid ${active ? "var(--np-crimson)" : "var(--border)"}`,
              background: active ? "var(--crimson-soft)" : "var(--surface-2)",
              color: active ? "var(--np-crimson)" : "var(--text-muted)",
            }}
          >
            <motion.span
              animate={{ rotate: active ? 0 : -20, scale: active ? 1 : 0.85 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="flex"
            >
              <Icon />
            </motion.span>
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ---------- preferences modal (fixed, blurred backdrop + 3D scene) ---------- */

function PreferencesModal({ lang, toggleLang, theme, setThemeAnimated, onContinue, t }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR.fast }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97, transition: { duration: DUR.fast } }}
        transition={{ duration: DUR.base, ease: EASE.out }}
        className="rounded-3xl relative w-full max-w-sm bg-surface border border-border shadow-lg"
      >
        <div className="p-8">
          <div className="text-center mb-8">
            <img src="/logo.jpg" alt="" className="w-14 h-14 mx-auto rounded-full object-contain mb-4" />
            <h1 className="font-bold text-xl text-text mb-1">Welcome to CiviMap</h1>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={lang}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.22 }}
                className="text-muted text-sm"
              >
                {t("login.heading")}
              </motion.p>
            </AnimatePresence>
          </div>

          <p className="text-xs font-semibold text-muted mb-2.5 tracking-wide uppercase">Choose Language</p>
          <LangSwitch lang={lang} toggleLang={toggleLang} />

          <p className="text-xs font-semibold text-muted mb-2.5 tracking-wide uppercase">Choose Theme</p>
          <ThemeSwitch theme={theme} setThemeAnimated={setThemeAnimated} />

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            type="button"
            onClick={onContinue}
            className="w-full py-3.5 rounded-full font-semibold flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--np-crimson)", color: "var(--text-on-brand)" }}
          >
            Continue <ArrowIcon />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- main welcome card (always mounted underneath) ---------- */

export default function WelcomePage() {
  const { t, lang, toggleLang } = useLang();
  const { theme, setThemeAnimated } = useTheme();
  const navigate = useNavigate();

  const [gateOpen, setGateOpen] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("civimap_prefs_chosen")
  );

  function handleContinue() {
    localStorage.setItem("civimap_prefs_chosen", "1");
    setGateOpen(false);
  }

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-4 py-10 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: EASE.out }}
        className="rounded-2xl relative w-full max-w-sm bg-surface"
        style={{
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="p-8 sm:p-9 text-center flex flex-col items-center">
          <motion.img
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            src="/logo.jpg"
            alt={t("appName")}
            className="w-16 h-16 rounded-full object-contain mb-5"
          />
          <h1 className="font-bold text-2xl mb-1.5" style={{ color: "var(--np-crimson)" }}>
            {t("appName")}
          </h1>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={lang}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="font-semibold text-xl text-text mb-2 leading-snug">
                {t("welcome.heading")}
              </h2>
              <p className="text-muted text-base mb-8 max-w-xs mx-auto leading-relaxed">
                {t("welcome.subtitle")}
              </p>
            </motion.div>
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.15 }}
            type="button"
            onClick={() => navigate("/login")}
            className="w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 mb-3"
            style={{
              backgroundColor: "var(--np-crimson)",
              color: "var(--text-on-brand)",
              boxShadow: "var(--shadow-btn)",
            }}
          >
            {t("welcome.login")}
            <ArrowIcon />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.015, backgroundColor: "var(--surface-2)" }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.15 }}
            type="button"
            onClick={() => navigate("/register")}
            className="w-full py-3.5 rounded-xl font-semibold text-base text-text mb-6"
            style={{ border: "1px solid var(--border-strong)", background: "transparent" }}
          >
            {t("welcome.register")}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            type="button"
            onClick={() => navigate("/admin/login")}
            className="text-sm text-muted hover:text-text transition-colors flex items-center gap-1.5"
          >
            <ShieldIcon />
            {t("welcome.adminLogin")}
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {gateOpen && (
          <PreferencesModal
            lang={lang}
            toggleLang={toggleLang}
            theme={theme}
            setThemeAnimated={setThemeAnimated}
            onContinue={handleContinue}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}