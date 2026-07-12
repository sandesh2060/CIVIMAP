// file: client/src/pages/user/dashboard/UserDashboard.jsx  (FULL FILE — replace existing)
import { useNavigate, useParams, Navigate } from "react-router-dom";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import FirstLoginNotificationModal from "../../../components/dashboard/FirstLoginNotificationModal";
import OverviewPage from "./OverviewPage";
import ReportsPage from "./ReportsPage";
import MapPage from "./MapPage";
import EmergencyPage from "./EmergencyPage";
import SettingsPage from "./SettingsPage";
import { useLang } from "../../../i18n/LanguageContext";

const NAV_ITEMS = [
  { id: "overview", labelKey: "nav.overview", icon: "overview" },
  { id: "reports", labelKey: "nav.reports", icon: "reports" },
  { id: "map", labelKey: "nav.map", icon: "map" },
  { id: "emergency", labelKey: "nav.emergency", icon: "emergency" },
  { id: "settings", labelKey: "nav.settings", icon: "settings" },
];

const PAGES = {
  overview: OverviewPage,
  reports: ReportsPage,
  map: MapPage,
  emergency: EmergencyPage,
  settings: SettingsPage,
};

const TITLE_KEYS = {
  overview: "nav.overview",
  reports: "nav.reports",
  map: "nav.map",
  emergency: "nav.emergency",
  settings: "nav.settings",
};

export default function UserDashboard() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();

  // The URL is the single source of truth for which tab is active —
  // no component state to lose on refresh. `/dashboard` with no tab,
  // or an unknown tab (typo'd URL, stale bookmark), normalizes to
  // `/dashboard/overview` so the address bar always matches what's
  // actually rendered.
  if (!tab || !PAGES[tab]) {
    return <Navigate to={`/dashboard/${tab && PAGES[tab] ? tab : "overview"}`} replace />;
  }

  const active = tab;

  // Both Sidebar clicks and any in-page onNavigate("settings")-style
  // calls (OverviewPage's quick actions, Topbar's profile menu, etc.)
  // go through this one function, which just changes the URL.
  function handleSelect(id) {
    if (!PAGES[id]) return;
    navigate(`/dashboard/${id}`);
  }

  return (
    <DashboardLayout
      items={NAV_ITEMS}
      active={active}
      onSelect={handleSelect}
      title={t(TITLE_KEYS[active])}
    >
      <FirstLoginNotificationModal />

      {/*
        All pages mount ONCE, here, on first dashboard load — not
        swapped in/out per tab. Switching tabs only changes which one
        is visible (via CSS), so ReportsPage/MapPage never lose their
        already-fetched data, open socket connections, or scroll
        position just because you clicked away and came back.

        `active` still drives what's *visible*; it just no longer
        drives what's *mounted*.
      */}
      {Object.entries(PAGES).map(([id, Page]) => (
        <div key={id} className={id === active ? "block" : "hidden"}>
          <Page onNavigate={handleSelect} />
        </div>
      ))}
    </DashboardLayout>
  );
}