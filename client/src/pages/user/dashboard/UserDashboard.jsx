// file: client/src/pages/user/dashboard/UserDashboard.jsx  (FULL FILE — replace existing)
import { useState } from "react";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
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
  const [active, setActive] = useState("overview");
  const { t } = useLang();
  const ActivePage = PAGES[active] || OverviewPage;

  return (
    <DashboardLayout
      items={NAV_ITEMS}
      active={active}
      onSelect={setActive}
      title={t(TITLE_KEYS[active])}
    >
      <ActivePage onNavigate={setActive} />
    </DashboardLayout>
  );
}