// file: client/src/components/LangFade.jsx
// Wrap any region whose text should crossfade (not snap) on language switch.
// Keying on `lang` makes Framer Motion fade the old tree out and new in,
// as ONE coordinated transition — no per-element jitter.
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";

export default function LangFade({ children, className }) {
  const { lang } = useLang();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={lang}
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}