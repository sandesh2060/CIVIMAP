// file: client/src/pages/user/dashboard/SettingsPage.jsx
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { EASE } from "../../../config/tokens";

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

function Notice({ type, children }) {
  const isError = type === "error";
  return (
    <motion.p
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="text-[12.5px] text-center py-2.5 rounded-[10px]"
      style={{
        color: isError ? "var(--np-crimson)" : "#1e7e34",
        background: isError ? "var(--crimson-soft)" : "#e6f4ea",
      }}
    >
      {children}
    </motion.p>
  );
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function SettingsPage() {
  const {
    user,
    updateProfile,
    changePassword,
    logoutAllDevices,
    uploadAvatar,
    removeAvatar,
  } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [profileStatus, setProfileStatus] = useState(null); // { type, message }
  const [profileLoading, setProfileLoading] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwStatus, setPwStatus] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);

  const [logoutAllLoading, setLogoutAllLoading] = useState(false);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef(null);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileStatus(null);
    if (name.trim().length < 2) {
      setProfileStatus({ type: "error", message: "Name must be at least 2 characters" });
      return;
    }
    setProfileLoading(true);
    try {
      await updateProfile(name.trim());
      setProfileStatus({ type: "success", message: "Profile updated" });
    } catch (err) {
      setProfileStatus({ type: "error", message: err?.response?.data?.error || "Could not update profile" });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwStatus(null);
    setPwLoading(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "" });
      setPwStatus({ type: "success", message: "Password changed. Other devices have been logged out." });
    } catch (err) {
      setPwStatus({ type: "error", message: err?.response?.data?.error || "Could not change password" });
    } finally {
      setPwLoading(false);
    }
  }

  async function handleLogoutAll() {
    setLogoutAllLoading(true);
    try {
      await logoutAllDevices();
      navigate("/login");
    } finally {
      setLogoutAllLoading(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (file.size > 3 * 1024 * 1024) {
      setAvatarError("Image must be under 3MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Only JPG, PNG, or WEBP images are allowed");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAvatarLoading(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      setAvatarError(err?.response?.data?.error || "Could not upload image");
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
      setAvatarError(err?.response?.data?.error || "Could not remove image");
    } finally {
      setAvatarLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="font-display text-2xl font-semibold">Settings</h2>
        <p className="text-muted text-sm mt-1">Manage your profile, password, and active sessions.</p>
      </div>

      {/* Profile picture */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Profile picture</h3>
        <div className="flex items-center gap-5 flex-wrap">
          <div
            className="w-20 h-20 rounded-full overflow-hidden shrink-0 grid place-items-center"
            style={{ background: "var(--np-blue)" }}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xl font-medium">{getInitials(user?.name)}</span>
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
                {avatarLoading ? "Uploading..." : "Upload photo"}
              </button>
              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarLoading}
                  className="py-2 px-4 text-[13px] font-medium rounded-[10px] border disabled:opacity-70"
                  style={{ borderColor: "var(--border-strong)", color: "var(--muted)" }}
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11.5px] text-muted">JPG, PNG or WEBP. Max 3MB.</p>
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

      {/* Profile */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Profile</h3>
        <form onSubmit={handleProfileSubmit}>
          <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="mb-4">
            <label className="block text-[12px] font-medium text-text mb-1.5">Email</label>
            <input
              value={user?.email || ""}
              disabled
              className="w-full py-2.5 px-3.5 text-[14px] text-muted rounded-[10px] cursor-not-allowed"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
            />
          </div>
          <AnimatePresence>
            {profileStatus && <Notice type={profileStatus.type}>{profileStatus.message}</Notice>}
          </AnimatePresence>
          <button
            type="submit"
            disabled={profileLoading}
            className="py-2.5 px-5 text-[14px] font-medium rounded-[10px] disabled:opacity-70"
            style={{ background: "var(--np-crimson)", color: "var(--text-on-brand)" }}
          >
            {profileLoading ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Change password</h3>
        <form onSubmit={handlePasswordSubmit}>
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
          />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
          />
          <AnimatePresence>
            {pwStatus && <Notice type={pwStatus.type}>{pwStatus.message}</Notice>}
          </AnimatePresence>
          <button
            type="submit"
            disabled={pwLoading}
            className="py-2.5 px-5 text-[14px] font-medium rounded-[10px] disabled:opacity-70"
            style={{ background: "var(--np-crimson)", color: "var(--text-on-brand)" }}
          >
            {pwLoading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>

      {/* Sessions */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="font-display font-semibold text-lg mb-2">Active sessions</h3>
        <p className="text-muted text-sm mb-4">
          Sign out of this account on all devices, including this one.
        </p>
        <button
          onClick={handleLogoutAll}
          disabled={logoutAllLoading}
          className="py-2.5 px-5 text-[14px] font-medium rounded-[10px] border disabled:opacity-70"
          style={{ borderColor: "var(--np-crimson)", color: "var(--np-crimson)" }}
        >
          {logoutAllLoading ? "Signing out..." : "Log out of all devices"}
        </button>
      </div>
    </div>
  );
}