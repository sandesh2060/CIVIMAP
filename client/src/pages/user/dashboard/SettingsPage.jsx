// file: client/src/pages/user/dashboard/SettingsPage.jsx
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../hooks/useTheme";
import { useLang } from "../../../i18n/LanguageContext";
import { fmtNum } from "../../../i18n/numbers";
import AccordionSection from "../../../components/ui/Accordion";

/* ---------------------------------------------------------------------- */
/*  Small shared bits                                                      */
/* ---------------------------------------------------------------------- */

function Field({ label, ...props }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-medium text-text mb-1.5">{label}</label>
      <input
        className="w-full py-2.5 px-3.5 text-[14px] text-text placeholder:text-placeholder outline-none transition-colors rounded-[10px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}
        onFocus={(e) => { e.target.style.borderColor = "var(--np-blue)"; e.target.style.boxShadow = "0 0 0 3px var(--blue-soft)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; e.target.style.boxShadow = "none"; }}
        {...props}
      />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-medium text-text mb-1.5">{label}</label>
      <select
        className="w-full py-2.5 px-3.5 text-[14px] text-text outline-none transition-colors rounded-[10px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

function ReadOnlyRow({ label, value, badge }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[13.5px] font-medium text-text flex items-center gap-2">
        {value}
        {badge}
      </span>
    </div>
  );
}

function VerifiedBadge({ verified, verifiedLabel, unverifiedLabel }) {
  return (
    <span
      className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
      style={{
        background: verified ? "var(--green-soft)" : "var(--crimson-soft)",
        color: verified ? "var(--np-green)" : "var(--np-crimson)",
      }}
    >
      {verified ? verifiedLabel : unverifiedLabel}
    </span>
  );
}

function Notice({ type, children }) {
  const isError = type === "error";
  return (
    <motion.p
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="text-[12.5px] text-center py-2.5 rounded-[10px]"
      style={{
        color: isError ? "var(--np-crimson)" : "var(--np-green)",
        background: isError ? "var(--crimson-soft)" : "var(--green-soft)",
      }}
    >
      {children}
    </motion.p>
  );
}

// Small iOS-style toggle switch, used for the notification prefs and the
// light/dark + language pickers below.
function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full flex-shrink-0 disabled:opacity-50"
      style={{ background: checked ? "var(--np-crimson)" : "var(--border-strong)" }}
    >
      <motion.span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </button>
  );
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toDateInputValue(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------- */
/*  Page                                                                   */
/* ---------------------------------------------------------------------- */

export default function SettingsPage() {
  const { user, updateProfile, logoutAllDevices, uploadAvatar, removeAvatar } = useAuth();
  const { theme, setThemeAnimated } = useTheme();
  const { lang, setLanguage, t } = useLang();
  const navigate = useNavigate();

  /* ---------- avatar ---------- */
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef(null);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (file.size > 3 * 1024 * 1024) {
      setAvatarError(t("settings.avatarTooLarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError(t("settings.avatarBadType"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAvatarLoading(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      setAvatarError(err?.response?.data?.message || t("settings.avatarUploadError"));
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    setAvatarLoading(true);
    setAvatarError("");
    try {
      await removeAvatar();
    } catch (err) {
      setAvatarError(err?.response?.data?.message || t("settings.avatarRemoveError"));
    } finally {
      setAvatarLoading(false);
    }
  }

  /* ---------- personal info (editable, saved as one batch) ---------- */
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    dateOfBirth: toDateInputValue(user?.dateOfBirth),
    gender: user?.gender || "prefer_not_to_say",
    address: {
      province: user?.address?.province || "",
      district: user?.address?.district || "",
      municipality: user?.address?.municipality || "",
      wardNo: user?.address?.wardNo || "",
      street: user?.address?.street || "",
    },
  });
  const [infoStatus, setInfoStatus] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);

  useEffect(() => {
    setForm({
      fullName: user?.fullName || "",
      dateOfBirth: toDateInputValue(user?.dateOfBirth),
      gender: user?.gender || "prefer_not_to_say",
      address: {
        province: user?.address?.province || "",
        district: user?.address?.district || "",
        municipality: user?.address?.municipality || "",
        wardNo: user?.address?.wardNo || "",
        street: user?.address?.street || "",
      },
    });
  }, [user]);

  function setAddressField(key, value) {
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  }

  async function handleInfoSubmit(e) {
    e.preventDefault();
    setInfoStatus(null);
    if (form.fullName.trim().length < 2) {
      setInfoStatus({ type: "error", message: t("settings.nameTooShort") });
      return;
    }
    setInfoLoading(true);
    try {
      await updateProfile({
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender,
        address: {
          ...form.address,
          wardNo: form.address.wardNo === "" ? null : Number(form.address.wardNo),
        },
      });
      setInfoStatus({ type: "success", message: t("settings.saved") });
    } catch (err) {
      setInfoStatus({ type: "error", message: err?.response?.data?.message || t("settings.saveError") });
    } finally {
      setInfoLoading(false);
    }
  }

  /* ---------- preferences (each change saves immediately) ---------- */
  const [prefsError, setPrefsError] = useState("");
  const [savingPref, setSavingPref] = useState(null); // which key is in flight, for a subtle disabled state

  async function persistPref(patch, key) {
    setPrefsError("");
    setSavingPref(key);
    try {
      await updateProfile(patch);
    } catch (err) {
      setPrefsError(err?.response?.data?.message || t("settings.saveError"));
    } finally {
      setSavingPref(null);
    }
  }

  function handleThemeSelect(next, e) {
    if (next === theme) return;
    setThemeAnimated(next, e); // drives the live circular-wipe UI immediately
    persistPref({ theme: next }, "theme"); // also remember it server-side
  }

  function handleLanguageSelect(next) {
    if (next === lang) return;
    setLanguage(next); // drives the UI immediately
    persistPref({ languagePref: next }, "languagePref");
  }

  function handleNotifToggle(key, value) {
    persistPref(
      { notificationPrefs: { ...user?.notificationPrefs, [key]: value } },
      `notif.${key}`
    );
  }

  /* ---------- sessions ---------- */
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  async function handleLogoutAll() {
    setLogoutAllLoading(true);
    try {
      await logoutAllDevices();
      navigate("/login");
    } finally {
      setLogoutAllLoading(false);
    }
  }

  const icon = (path) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--np-crimson)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("settings.heading")}</h2>
        <p className="text-muted text-sm mt-1">{t("settings.subtitle")}</p>
      </div>

      {/* Profile picture — always visible, not collapsed */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="font-display font-semibold text-lg mb-4">{t("settings.profilePicture")}</h3>
        <div className="flex items-center gap-5 flex-wrap">
          <div
            className="w-20 h-20 rounded-full overflow-hidden shrink-0 grid place-items-center"
            style={{ background: "var(--np-blue)" }}
          >
            {user?.profileImage?.url ? (
              <img src={user.profileImage.url} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xl font-medium">{getInitials(user?.fullName)}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="py-2 px-4 text-[13px] font-medium rounded-[10px] disabled:opacity-70"
                style={{ background: "var(--np-crimson)", color: "var(--text-on-brand)" }}
              >
                {avatarLoading ? t("settings.uploading") : t("settings.uploadPhoto")}
              </button>
              {user?.profileImage?.url && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarLoading}
                  className="py-2 px-4 text-[13px] font-medium rounded-[10px] border disabled:opacity-70"
                  style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}
                >
                  {t("settings.remove")}
                </button>
              )}
            </div>
            <p className="text-[11.5px] text-muted">{t("settings.photoHint")}</p>
            <AnimatePresence>
              {avatarError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[11.5px]"
                  style={{ color: "var(--np-crimson)" }}
                >
                  {avatarError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Personal info — editable */}
      <AccordionSection
        title={t("settings.personalInfo")}
        subtitle={t("settings.personalInfoHint")}
        defaultOpen
        icon={icon(<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>)}
      >
        <form onSubmit={handleInfoSubmit}>
          <Field
            label={t("settings.fullName")}
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("settings.dateOfBirth")}
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            />
            <Select
              label={t("settings.gender")}
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            >
              <option value="prefer_not_to_say">{t("settings.genderPreferNot")}</option>
              <option value="male">{t("settings.genderMale")}</option>
              <option value="female">{t("settings.genderFemale")}</option>
              <option value="other">{t("settings.genderOther")}</option>
            </Select>
          </div>

          <div className="mb-2 text-[12px] font-medium text-text">{t("settings.address")}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("settings.province")} value={form.address.province} onChange={(e) => setAddressField("province", e.target.value)} />
            <Field label={t("settings.district")} value={form.address.district} onChange={(e) => setAddressField("district", e.target.value)} />
            <Field label={t("settings.municipality")} value={form.address.municipality} onChange={(e) => setAddressField("municipality", e.target.value)} />
            <Field
              label={t("settings.wardNo")}
              type="number"
              min="1"
              value={form.address.wardNo}
              onChange={(e) => setAddressField("wardNo", e.target.value)}
            />
          </div>
          <Field label={t("settings.street")} value={form.address.street} onChange={(e) => setAddressField("street", e.target.value)} />

          {/* Read-only identity fields — registry-sourced, tied to OTP login */}
          <div className="mt-2 mb-4 rounded-[10px] border border-border p-3.5">
            <ReadOnlyRow label={t("settings.email")} value={user?.email} badge={
              <VerifiedBadge verified={user?.isEmailVerified} verifiedLabel={t("settings.verified")} unverifiedLabel={t("settings.unverified")} />
            } />
            <ReadOnlyRow label={t("settings.phone")} value={user?.phone} badge={
              <VerifiedBadge verified={user?.isPhoneVerified} verifiedLabel={t("settings.verified")} unverifiedLabel={t("settings.unverified")} />
            } />
            <ReadOnlyRow label={t("settings.citizenshipNumber")} value={user?.citizenshipNumber || t("settings.notProvided")} />
          </div>

          <AnimatePresence>
            {infoStatus && <Notice type={infoStatus.type}>{infoStatus.message}</Notice>}
          </AnimatePresence>

          <button
            type="submit"
            disabled={infoLoading}
            className="py-2.5 px-5 text-[14px] font-medium rounded-[10px] disabled:opacity-70"
            style={{ background: "var(--np-crimson)", color: "var(--text-on-brand)" }}
          >
            {infoLoading ? t("settings.saving") : t("settings.saveChanges")}
          </button>
        </form>
      </AccordionSection>

      {/* Preferences — theme, language, notifications */}
      <AccordionSection
        title={t("settings.preferences")}
        subtitle={t("settings.preferencesHint")}
        icon={icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>)}
      >
        <div className="space-y-5">
          <div>
            <p className="text-[12.5px] font-medium text-text mb-2">{t("settings.theme")}</p>
            <div className="flex gap-2">
              {[
                { key: "light", label: t("settings.themeLight") },
                { key: "dark", label: t("settings.themeDark") },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={(e) => handleThemeSelect(opt.key, e)}
                  disabled={savingPref === "theme"}
                  className="flex-1 py-2 text-[13px] font-medium rounded-[10px] border transition disabled:opacity-60"
                  style={{
                    borderColor: theme === opt.key ? "var(--np-crimson)" : "var(--border-strong)",
                    background: theme === opt.key ? "var(--crimson-soft)" : "transparent",
                    color: theme === opt.key ? "var(--np-crimson)" : "var(--text)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[12.5px] font-medium text-text mb-2">{t("settings.language")}</p>
            <div className="flex gap-2">
              {[
                { key: "en", label: "English" },
                { key: "ne", label: "नेपाली" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleLanguageSelect(opt.key)}
                  disabled={savingPref === "languagePref"}
                  className="flex-1 py-2 text-[13px] font-medium rounded-[10px] border transition disabled:opacity-60"
                  style={{
                    borderColor: lang === opt.key ? "var(--np-crimson)" : "var(--border-strong)",
                    background: lang === opt.key ? "var(--crimson-soft)" : "transparent",
                    color: lang === opt.key ? "var(--np-crimson)" : "var(--text)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[12.5px] font-medium text-text mb-2">{t("settings.notifications")}</p>
            <div className="rounded-[10px] border border-border divide-y divide-border">
              {[
                { key: "email", label: t("settings.notifEmail") },
                { key: "whatsapp", label: t("settings.notifWhatsapp") },
                { key: "sms", label: t("settings.notifSms") },
                { key: "push", label: t("settings.notifPush") },
              ].map((n) => (
                <div key={n.key} className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-[13px] text-text">{n.label}</span>
                  <Switch
                    checked={!!user?.notificationPrefs?.[n.key]}
                    disabled={savingPref === `notif.${n.key}`}
                    onChange={(v) => handleNotifToggle(n.key, v)}
                  />
                </div>
              ))}
            </div>
          </div>

          {prefsError && <p className="text-[12px]" style={{ color: "var(--np-crimson)" }}>{prefsError}</p>}
        </div>
      </AccordionSection>

      {/* Civic activity — read-only */}
      <AccordionSection
        title={t("settings.civicActivity")}
        subtitle={t("settings.civicActivityHint")}
        icon={icon(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>)}
      >
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-medium text-text">{t("settings.trustScore")}</span>
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--np-crimson)" }}>
              {fmtNum(user?.trustScore ?? 0, lang)} / 100
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${user?.trustScore ?? 0}%`, background: "var(--np-crimson)" }}
            />
          </div>
        </div>

        <div className="rounded-[10px] border border-border p-3.5">
          <ReadOnlyRow label={t("ov.reportsSubmitted")} value={fmtNum(user?.stats?.reportsSubmitted ?? 0, lang)} />
          <ReadOnlyRow label={t("ov.reportsApproved")} value={fmtNum(user?.stats?.reportsApproved ?? 0, lang)} />
          <ReadOnlyRow label={t("settings.reportsRejected")} value={fmtNum(user?.stats?.reportsRejected ?? 0, lang)} />
          <ReadOnlyRow label={t("ov.violationsSubmitted")} value={fmtNum(user?.stats?.violationsSubmitted ?? 0, lang)} />
          <ReadOnlyRow label={t("ov.violationsConfirmed")} value={fmtNum(user?.stats?.violationsConfirmed ?? 0, lang)} />
          <ReadOnlyRow label={t("settings.violationsRejected")} value={fmtNum(user?.stats?.violationsRejected ?? 0, lang)} />
          <ReadOnlyRow
            label={t("settings.memberSince")}
            value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString(lang === "ne" ? "ne-NP" : "en-US") : "—"}
          />
          <ReadOnlyRow
            label={t("settings.lastLogin")}
            value={user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(lang === "ne" ? "ne-NP" : "en-US") : "—"}
          />
        </div>
      </AccordionSection>

      {/* Sessions / security */}
      <AccordionSection
        title={t("settings.security")}
        subtitle={t("settings.securityHint")}
        icon={icon(<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />)}
      >
        <p className="text-muted text-sm mb-4">{t("settings.logoutAllDevicesHint")}</p>
        <button
          onClick={handleLogoutAll}
          disabled={logoutAllLoading}
          className="py-2.5 px-5 text-[14px] font-medium rounded-[10px] border disabled:opacity-70"
          style={{ borderColor: "var(--np-crimson)", color: "var(--np-crimson)" }}
        >
          {logoutAllLoading ? t("settings.signingOut") : t("settings.logoutAllDevices")}
        </button>
      </AccordionSection>
    </div>
  );
}