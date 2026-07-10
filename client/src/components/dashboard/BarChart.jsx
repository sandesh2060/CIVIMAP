// file: client/src/components/dashboard/BarChart.jsx
import { motion } from "framer-motion";
import { EASE } from "../../config/tokens";

export default function BarChart({ data, max, labelFor, emptyMessage }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const peak = max || Math.max(...data.map((d) => d.value), 1);

  if (total === 0) {
    return (
      <div className="h-44 mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
             className="w-8 h-8 text-faint">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-[13px] text-muted text-center max-w-xs px-4">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 h-44 mt-4">
      {data.map((d, i) => {
        const h = Math.round((d.value / peak) * 100);
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-2 group">
            <div className="w-full flex items-end h-full relative">
              {d.value > 0 && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-medium text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.value}
                </span>
              )}
              <motion.div
                className="w-full rounded-t-md min-h-[3px]"
                style={{ background: i % 2 ? "var(--np-blue)" : "var(--np-crimson)" }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(h, d.value > 0 ? 4 : 0)}%` }}
                transition={{ duration: 0.6, ease: EASE.out, delay: i * 0.06 }}
              />
            </div>
            <span className="text-xs text-muted">{labelFor(d.month)}</span>
          </div>
        );
      })}
    </div>
  );
}