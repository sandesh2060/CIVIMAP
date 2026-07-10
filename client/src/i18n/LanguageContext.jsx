// file: client/src/i18n/LanguageContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { translations } from "./translations";
import { toNepaliDigits } from "./numbers";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "en");

  useEffect(() => {
    document.documentElement.lang = lang === "ne" ? "ne" : "en";
  }, [lang]);

  const setLanguage = useCallback((l) => {
    setLang(l);
    localStorage.setItem("lang", l);
  }, []);

  const toggleLang = useCallback(
    () => setLanguage(lang === "en" ? "ne" : "en"),
    [lang, setLanguage]
  );

  // t("key") or t("stat.resolvedHint", { n: 860 })
  // In Nepali, any {n} value's digits are auto-converted to Devanagari.
  const t = useCallback(
    (key, vars) => {
      let str = translations[lang]?.[key] ?? translations.en?.[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          const val = lang === "ne" ? toNepaliDigits(v) : String(v);
          str = str.replaceAll(`{${k}}`, val);
        }
      }
      return str;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside <LanguageProvider>");
  return ctx;
}