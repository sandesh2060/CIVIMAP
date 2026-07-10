// file: client/src/pages/admin/AdminDashboard.jsx  (FULL FILE — replace existing)
import { useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ReportsPage from "./ReportsPage";
import ViolationsPage from "./ViolationsPage";
import EmergencyMonitorPage from "./EmergencyMonitorPage";
import PlacesPage from "./PlacesPage";
import { useLang } from "../../i18n/LanguageContext";

function OverviewPlaceholder() {
  const { t } = useLang();
  return <div className="text-sm text-muted">{t("nav.overview")} — coming soon</div>;
}

const NAV_ITEMS = [
  { id: "overview", labelKey: "nav.overview", icon: "overview" },
  { id: "reports", labelKey: "nav.reports", icon: "reports" },
  { id: "violations", labelKey: "nav.violations", icon: "reports" },
  { id: "emergency", labelKey: "nav.emergency", icon: "emergency" },
  { id: "places", labelKey: "nav.places", icon: "map" },
];

const PAGES = {
  overview: OverviewPlaceholder,
  reports: ReportsPage,
  violations: ViolationsPage,
  emergency: EmergencyMonitorPage,
  places: PlacesPage,
};

const TITLE_KEYS = {
  overview: "nav.overview",
  reports: "nav.reports",
  violations: "nav.violations",
  emergency: "nav.emergency",
  places: "nav.places",
};

export default function AdminDashboard() {
  const [active, setActive] = useState("overview");
  const { t } = useLang();
  const ActivePage = PAGES[active] || OverviewPlaceholder;

  return (
    <DashboardLayout items={NAV_ITEMS} active={active} onSelect={setActive} title={t(TITLE_KEYS[active])}>
      <ActivePage onNavigate={setActive} />
    </DashboardLayout>
  );
}