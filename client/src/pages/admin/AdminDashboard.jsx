// file: client/src/pages/admin/AdminDashboard.jsx
import { useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import OverviewPage from "./OverviewPage";
import ReportsPage from "./ReportsPage";
import ViolationsPage from "./ViolationsPage";
import EmergencyMonitorPage from "./EmergencyMonitorPage";
import BroadcastPage from "./BroadcastPage";
import FeedPage from "./FeedPage";  
import PlacesPage from "./PlacesPage";
import { useLang } from "../../i18n/LanguageContext";

const NAV_ITEMS = [
  { id: "overview", labelKey: "nav.overview", icon: "overview" },
   { id: "feed", labelKey: "nav.feed", icon: "feed" }, 
  { id: "reports", labelKey: "nav.reports", icon: "reports" },
  { id: "violations", labelKey: "nav.violations", icon: "reports" },
  { id: "emergency", labelKey: "nav.emergency", icon: "emergency" },
  { id: "places", labelKey: "nav.places", icon: "map" },
  { id: "broadcast", labelKey: "nav.broadcast", icon: "emergency" },
];

const PAGES = {
  overview: OverviewPage,
  feed: FeedPage, 
  reports: ReportsPage,
  violations: ViolationsPage,
  emergency: EmergencyMonitorPage,
  places: PlacesPage,
  broadcast: BroadcastPage,
};

const TITLE_KEYS = {
  overview: "nav.overview",
   feed: "nav.feed", 
  reports: "nav.reports",
  violations: "nav.violations",
  emergency: "nav.emergency",
  places: "nav.places",
  broadcast: "nav.broadcast",
};

export default function AdminDashboard() {
  const [active, setActive] = useState("overview");
  const { t } = useLang();
  const ActivePage = PAGES[active] || OverviewPage;

  return (
    <DashboardLayout items={NAV_ITEMS} active={active} onSelect={setActive} title={t(TITLE_KEYS[active])}>
      <ActivePage onNavigate={setActive} />
    </DashboardLayout>
  );
}