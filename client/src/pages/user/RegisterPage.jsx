// file: client/src/pages/user/RegisterPage.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { EASE } from "../../config/tokens";

function ArrowIcon(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function EyeIcon(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function EyeOffIcon(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M3 3l18 18M9.9 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a15.5 15.5 0 0 1-3.2 4.1M6.5 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.7M14.1 14.1a3 3 0 0 1-4.2-4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FIELD_RADIUS = "10px";

// Mirrors the exact rule set enforced by registerValidators in
// server/src/routes/authRoutes.js — keep these in sync if the backend
// rule ever changes, or users will pass client validation and still
// get rejected server-side.
function validatePassword(pw) {
  if (pw.length < 10) return "Password must be at least 10 characters";
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter";
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter";
  if (!/[0-9]/.test(pw)) return "Password must include a number";
  return null;
}

function InputField({ label, id, error, type = "text", showToggle, hint, ...props }) {
  const [show, setShow] = useState(false);
  const resolvedType = showToggle ? (show ? "text" : "password") : type;

  return (
    <div className="mb-4 text-left">
      <label htmlFor={id} className="block text-[12px] font-medium text-text mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={resolvedType}
          className="w-full py-2.5 px-3.5 text-[14px] text-text placeholder:text-placeholder outline-none transition-colors"
          style={{
            borderRadius: FIELD_RADIUS,
            background: "var(--surface)",
            border: `1px solid ${error ? "var(--np-crimson)" : "var(--border-strong)"}`,
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--np-blue)"; e.target.style.boxShadow = "0 0 0 3px var(--blue-soft)"; }}
          onBlur={(e) => { e.target.style.borderColor = error ? "var(--np-crimson)" : "var(--border-strong)"; e.target.style.boxShadow = "none"; }}
          {...props}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error ? (
        <p className="text-[11.5px] mt-1.5" style={{ color: "var(--np-crimson)" }}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] mt-1.5 text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useLang();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: null }));
    if (formError) setFormError("");
  }

  function validate() {
    const next = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      next.name = "Name must be at least 2 characters";
    }
    if (!form.email.trim()) {
      next.email = "Email is required";
    }

    const pwError = validatePassword(form.password);
    if (pwError) next.password = pwError;

    if (form.confirmPassword !== form.password) {
      next.confirmPassword = "Passwords don't match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setLoading(true);
    try {
      // AuthContext.register expects (name, email, password) as three
      // positional arguments, NOT an object — matches the signature in
      // client/src/context/AuthContext.jsx exactly.
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate("/");
    } catch (err) {
      // server/src/middleware/errorHandler.js returns { error: "..." },
      // not { message: "..." } — reading the wrong field here silently
      // swallows the real backend message on every failure.
      setFormError(
        err?.response?.data?.error || "Something went wrong. Please try again."
      );
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
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="px-8 pt-9 pb-8 text-center flex flex-col items-center">
          <img
            src="/logo.jpg"
            alt={t("appName")}
            className="w-11 h-11 rounded-full object-contain mb-3.5 ring-1 ring-black/5"
          />

          <p className="lux-eyebrow mb-2">Government of Nepal</p>

          <h1 className="font-display font-medium text-[24px] text-text mb-1">
            Create an account
          </h1>
          <p className="text-muted text-[13px] mb-5">
            Join CiviMap to report and track civic issues
          </p>

          <div className="w-10 h-px mb-6" style={{ background: "var(--np-gold)" }} />

          <form onSubmit={handleSubmit} noValidate className="w-full">
            <InputField
              label="Full name"
              id="name"
              name="name"
              type="text"
              placeholder="First and last name"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
              autoComplete="name"
            />
            <InputField
              label="Email"
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              autoComplete="email"
            />
            <InputField
              label="Password"
              id="password"
              name="password"
              showToggle
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              hint={!errors.password ? "At least 10 characters, with upper, lower & a number" : null}
              autoComplete="new-password"
            />
            <InputField
              label="Confirm password"
              id="confirmPassword"
              name="confirmPassword"
              showToggle
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            <AnimatePresence>
              {formError && (
                <motion.p
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="text-[12px] text-center py-2.5"
                  style={{ color: "var(--np-crimson)", background: "var(--crimson-soft)", borderRadius: FIELD_RADIUS }}
                >
                  {formError}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: loading ? 1 : 0.985 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-70 mt-1"
              style={{
                borderRadius: FIELD_RADIUS,
                background: "var(--np-crimson)",
                color: "var(--text-on-brand)",
                boxShadow: "var(--shadow-btn)",
              }}
            >
              {loading ? (
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <>
                  Create account
                  <ArrowIcon />
                </>
              )}
            </motion.button>
          </form>
        </div>

        <div className="px-8 py-4 text-center" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[12.5px] text-muted">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="font-medium hover:underline"
              style={{ color: "var(--np-crimson)" }}
            >
              Log in
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}