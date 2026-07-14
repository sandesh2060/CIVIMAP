// file: client/src/pages/admin/AdminLoginPage.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { EASE } from "../../config/tokens";
import FormField from "../../components/ui/FormField";
import Button from "../../components/ui/Button";

function ArrowIcon(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminLoginPage() {
  const { t } = useLang();
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from?.pathname || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }

    setLoading(true);
    try {
      await adminLogin(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-4 py-10 font-sans relative isolate">
      <div className="lux-grain" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE.out }}
        className="relative w-full max-w-sm overflow-hidden z-10"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}
      >
        <div className="px-8 pt-9 pb-8 text-center flex flex-col items-center">
          <img src="/logo.jpg" alt={t("appName")} className="w-11 h-11 rounded-full object-contain mb-3.5 ring-1 ring-black/5" />
          <p className="lux-eyebrow mb-2">Government of Nepal</p>
          <h1 className="font-display font-medium text-[24px] text-text mb-1">Admin Sign In</h1>
          <p className="text-muted text-[13px] mb-5">Staff access to the CiviMap control panel</p>

          <div className="w-10 h-px mb-6" style={{ background: "var(--np-gold)" }} />

          <form onSubmit={handleSubmit} noValidate className="w-full">
            <FormField
              label="Email address"
              id="admin-email"
              name="email"
              type="email"
              placeholder="admin@civimap.gov.np"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
              autoComplete="username"
            />
            <FormField
              label="Password"
              id="admin-password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
              error={error}
              autoComplete="current-password"
            />

            <Button type="submit" loading={loading} icon={!loading && <ArrowIcon />}>
              Sign in
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}