import { motion } from "framer-motion";
import { EASE, DUR } from "../../config/tokens";

export default function AuthCard({ eyebrow, title, subtitle, children, footer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: DUR.slow, ease: EASE.out }}
      className="rounded-2xl relative w-full max-w-md overflow-hidden z-10 max-h-[92vh] flex flex-col bg-surface"
      style={{ border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-lg)" }}
    >
      <div className="p-8 sm:p-10 overflow-y-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full p-2.5 flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
            <img src="/logo.jpg" alt="" className="w-full h-full rounded-full object-contain" />
          </div>
          {eyebrow && <p className="lux-eyebrow mb-2.5">{eyebrow}</p>}
          <h1 className="font-bold text-2xl text-text">{title}</h1>
          {subtitle && <p className="text-muted text-base mt-1.5">{subtitle}</p>}
        </div>

        <div className="lux-divider mb-7" />

        {children}
      </div>

      {footer && (
        <div className="border-t px-8 sm:px-10 py-5 text-center" style={{ borderColor: "var(--border-strong)" }}>
          {footer}
        </div>
      )}
    </motion.div>
  );
}