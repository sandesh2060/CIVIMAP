// file: client/src/components/ui/Accordion.jsx
import { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE } from "../../config/tokens";

// A single collapsible section — click the header div, the panel expands
// and collapses with a smooth height+opacity animation using the same
// EASE tokens DashboardLayout's own motion uses, so this reads as native
// to the app rather than a differently-tuned animation bolted on.
export default function AccordionSection({ title, subtitle, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span
              className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "var(--crimson-soft)" }}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-base text-text">{title}</h3>
            {subtitle && <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: EASE.out }}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE.smooth }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-5 border-t border-border">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}