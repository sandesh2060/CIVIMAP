// file: client/src/pages/user/LoginPage.jsx

import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../../i18n/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { EASE } from "../../config/tokens";

const RESEND_COOLDOWN_SEC = 45;
const FIELD_RADIUS = "10px";

// Mirrors server/src/utils/identifier.js normalizePhone() — a bare
// 10-digit local number gets +977 prefixed before it's sent to the API,
// so citizens can type "9745496290" instead of "+9779745496290".
function normalizeIdentifierForSubmit(value) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed; // email — leave as typed
  if (trimmed.startsWith("+")) return trimmed; // already has a country code
  if (/^[0-9]{10}$/.test(trimmed)) return `+977${trimmed}`;
  return trimmed;
}

function ArrowIcon(props) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InputField({ label, id, error, hint, ...props }) {
  return (
    <div className="mb-4 text-left">
      <label htmlFor={id} className="block text-[12px] font-medium text-text mb-1.5">
        {label}
      </label>
      <input
        id={id}
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
      {error ? (
        <p className="text-[11.5px] mt-1.5" style={{ color: "var(--np-crimson)" }}>{error}</p>
      ) : hint ? (
        <p className="text-[11.5px] mt-1.5 text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLang();
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from?.pathname || "/dashboard";

  const [step, setStep] = useState("identifier"); // "identifier" | "otp"
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState(null);
  const [maskedIdentifier, setMaskedIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpInputRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  async function handleRequestOtp(e) {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) {
      setError("Enter your email or phone number");
      return;
    }

    const submittedIdentifier = normalizeIdentifierForSubmit(identifier);

    setLoading(true);
    try {
      const res = await requestOtp(submittedIdentifier);
      setChannel(res.channel);
      setMaskedIdentifier(res.maskedIdentifier);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't send a code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }

    const submittedIdentifier = normalizeIdentifierForSubmit(identifier);

    setLoading(true);
    try {
      await verifyOtp(submittedIdentifier, code.trim());
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError("");
    const submittedIdentifier = normalizeIdentifierForSubmit(identifier);
    try {
      const res = await requestOtp(submittedIdentifier);
      setChannel(res.channel);
      setMaskedIdentifier(res.maskedIdentifier);
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't resend the code. Please try again.");
    }
  }

  function handleChangeIdentifier() {
    setStep("identifier");
    setCode("");
    setError("");
    setCooldown(0);
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
          <h1 className="font-display font-medium text-[24px] text-text mb-1">Welcome back</h1>
          <p className="text-muted text-[13px] mb-5">
            {step === "identifier"
              ? "Log in to report and track civic issues"
              : `Enter the code sent via ${channel === "email" ? "email" : "WhatsApp"} to ${maskedIdentifier}`}
          </p>

          <div className="w-10 h-px mb-6" style={{ background: "var(--np-gold)" }} />

          <AnimatePresence mode="wait">
            {step === "identifier" ? (
              <motion.form
                key="identifier"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleRequestOtp}
                noValidate
                className="w-full"
              >
                <InputField
                  label="Email or phone number"
                  id="identifier"
                  name="identifier"
                  placeholder="you@example.com or 98XXXXXXXX"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); if (error) setError(""); }}
                  error={error}
                  hint="Nepal numbers: just type the 10 digits — we'll add +977 automatically"
                  autoComplete="username"
                />

                <motion.button
                  whileTap={{ scale: loading ? 1 : 0.985 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-70 mt-1"
                  style={{ borderRadius: FIELD_RADIUS, background: "var(--np-crimson)", color: "var(--text-on-brand)", boxShadow: "var(--shadow-btn)" }}
                >
                  {loading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <>Send code <ArrowIcon /></>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="otp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleVerifyOtp}
                noValidate
                className="w-full"
              >
                <InputField
                  ref={otpInputRef}
                  label="6-digit code"
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); if (error) setError(""); }}
                  error={error}
                  autoComplete="one-time-code"
                />

                <motion.button
                  whileTap={{ scale: loading ? 1 : 0.985 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-70 mt-1"
                  style={{ borderRadius: FIELD_RADIUS, background: "var(--np-crimson)", color: "var(--text-on-brand)", boxShadow: "var(--shadow-btn)" }}
                >
                  {loading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <>Verify and log in <ArrowIcon /></>
                  )}
                </motion.button>

                <div className="flex items-center justify-between mt-4 text-[12.5px]">
                  <button type="button" onClick={handleChangeIdentifier} className="text-muted hover:underline">
                    Change email/phone
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0}
                    className="font-medium disabled:opacity-50"
                    style={{ color: "var(--np-crimson)" }}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}