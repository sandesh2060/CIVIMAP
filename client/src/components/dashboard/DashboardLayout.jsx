// file: client/src/components/dashboard/DashboardLayout.jsx  (FULL FILE — replace existing)
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import LiveNotificationPopup from "./LiveNotificationPopup";
import { EASE } from "../../config/tokens";

/*
  Reusable dashboard shell with HOVER-TO-EXPAND sidebar.
  - Desktop: sidebar is a real flex item (not an overlay). Its width
    animates between RAIL and FULL, and because it's part of the flex
    row, the main content column smoothly reflows alongside it —
    nothing ever gets hidden underneath.
  - Mobile: hamburger opens a slide-in drawer (always expanded, still
    an overlay there since it's meant to sit on top on small screens).

  IMPORTANT: `children` now contains ALL dashboard pages at once (see
  UserDashboard.jsx) — the caller toggles which one is visible via
  CSS, not by swapping which component is mounted. That means this
  layout must NOT wrap `children` in anything keyed by `active`
  (e.g. <motion.div key={active}>) — doing so would force React to
  unmount and remount the entire children subtree on every tab
  switch, defeating the whole point (every page would refetch its
  data and reconnect its sockets again, right back to the original
  bug). So `children` is rendered plain below, with no key-driven
  animation on it.
*/

const RAIL = 76;
const FULL = 256;

export default function DashboardLayout({ items, active, onSelect, title, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hover, setHover] = useState(false);

  const handleSelect = (id) => {
    onSelect?.(id);
    setDrawerOpen(false);
  };

  return (
    <div className="h-screen flex bg-bg text-text overflow-hidden">
      {/* Mounted at the shell level — stays alive across tab switches,
          same as before. */}
      <LiveNotificationPopup />

      {/* ===== Desktop sidebar: real flex item, width animates, content reflows ===== */}
      <motion.aside
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        initial={false}
        animate={{ width: hover ? FULL : RAIL }}
        transition={{ duration: 0.35, ease: EASE.smooth }}
        className="hidden md:block shrink-0 h-screen bg-surface border-r border-border
                   overflow-hidden relative z-30"
        style={{ boxShadow: hover ? "var(--shadow-lg)" : "none" }}
      >
        <Sidebar items={items} active={active} onSelect={handleSelect} expanded={hover} />
      </motion.aside>

      {/* ===== Mobile drawer ===== */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed top-0 left-0 z-50 h-full w-64 bg-surface border-r border-border md:hidden"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ duration: 0.32, ease: EASE.smooth }}
            >
              <Sidebar items={items} active={active} onSelect={handleSelect} expanded />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ===== Main column ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenu={() => setDrawerOpen(true)} onNavigate={onSelect} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}