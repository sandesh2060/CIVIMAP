// file: client/src/components/emergency/CategoryButton.jsx
import { motion } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";

const CATEGORY_META = {
  ambulance: {
    color: "#DC143C",
    soft: "var(--crimson-soft)",
    path: "M12 2a1 1 0 011 1v3h3a1 1 0 011 1v10a1 1 0 01-1 1H8a1 1 0 01-1-1V7a1 1 0 011-1h3V3a1 1 0 011-1zM9 10h6M12 7v6",
  },
  fire: {
    color: "#EA580C",
    soft: "rgba(234,88,12,0.1)",
    path: "M12 2s4 4 4 8a4 4 0 01-8 0c0-1 .5-2 1-3-1 3 1 5 3 5s3-2 3-3c0-3-3-5-3-7z M8 15a4 4 0 108 0",
  },
  police: {
    color: "var(--np-blue)",
    soft: "var(--blue-soft, rgba(0,56,147,0.1))",
    path: "M12 2l7 3v6c0 5-3 8.5-7 11-4-2.5-7-6-7-11V5l7-3z",
  },
  rescue: {
    color: "#0F766E",
    soft: "rgba(15,118,110,0.1)",
    path: "M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z M12 7v6M9 10h6",
  },
};

export default function CategoryButton({ category, selected, onClick }) {
  const { t } = useLang();
  const meta = CATEGORY_META[category] || CATEGORY_META.rescue;

  return (
    <motion.button
      type="button"
      onClick={() => onClick(category)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-colors"
      style={{
        borderColor: selected ? meta.color : "var(--border)",
        background: selected ? meta.soft : "var(--surface)",
      }}
    >
      <span
        className="w-12 h-12 rounded-full grid place-items-center"
        style={{ background: meta.soft, color: meta.color }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d={meta.path} />
        </svg>
      </span>
      <span className="font-semibold text-sm text-text">{t(`emergency.category.${category}`)}</span>
    </motion.button>
  );
}