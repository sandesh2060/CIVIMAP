// file: client/src/components/dashboard/StatCard.jsx
import { motion } from "framer-motion";
import { EASE } from "../../config/tokens";

/*
  accent: "crimson" | "blue" | "neutral"
  icon: optional path string (24x24 viewBox, stroke-based) — pass one of
  the shapes below or your own. Icon sits in a soft accent-tinted circle
  so the card reads instantly instead of being a bare number.
*/
export default function StatCard({ label, value, hint, accent = "neutral", icon, delay = 0 }) {
  const accentColor =
    accent === "crimson" ? "var(--np-crimson)" : accent === "blue" ? "var(--np-blue)" : "var(--text-muted, #6b7280)";
  const accentSoft =
    accent === "crimson" ? "var(--crimson-soft)" : accent === "blue" ? "var(--blue-soft, rgba(0,56,147,0.1))" : "var(--surface2, rgba(0,0,0,0.05))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.4, ease: EASE.out, delay }}
      className="relative bg-surface rounded-xl p-5 border border-border/60"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
          {label}
        </div>
        {icon && (
          <span
            className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
            style={{ background: accentSoft, color: accentColor }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d={icon} />
            </svg>
          </span>
        )}
      </div>
      <div className="mt-3 text-[2rem] leading-none font-display font-semibold text-text tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-2 text-[13px] text-muted">{hint}</div>}
    </motion.div>
  );
}