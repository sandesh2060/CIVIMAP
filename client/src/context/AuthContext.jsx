// file: client/src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api, { setAccessToken, setUnauthorizedHandler } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    (async () => {
      try {
        const res = await api.post("/auth/refresh");
        setAccessToken(res.data.data.accessToken);
        // /auth/refresh only returns a new accessToken, not the account —
        // fetch the account separately so `user` is populated on reload.
        const meRes = await api.get("/auth/me");
        setUser(meRes.data.data.account);
      } catch {
        clearSession();
      } finally {
        setInitializing(false);
      }
    })();
  }, [clearSession]);

  const requestOtp = useCallback(async (identifier) => {
    const res = await api.post("/auth/otp/request", { identifier });
    return res.data.data; // { channel, maskedIdentifier }
  }, []);

  const verifyOtp = useCallback(async (identifier, code, deviceId) => {
    const res = await api.post("/auth/otp/verify", { identifier, code, deviceId });
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAllDevices = useCallback(async () => {
    try {
      await api.post("/auth/logout-all");
    } finally {
      clearSession();
    }
  }, [clearSession]);

  // Takes a partial-updates object matching the server's allow-list:
  // { fullName?, dateOfBirth?, gender?, address?, languagePref?,
  //   theme?, notificationPrefs? }
  // e.g. updateProfile({ fullName: "New Name" })
  //      updateProfile({ address: { province: "Bagmati" } })
  const updateProfile = useCallback(async (updates) => {
    const res = await api.patch("/auth/me", updates);
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const uploadAvatar = useCallback(async (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    const res = await api.post("/auth/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const removeAvatar = useCallback(async () => {
    const res = await api.delete("/auth/me/avatar");
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        requestOtp,
        verifyOtp,
        logout,
        logoutAllDevices,
        updateProfile,
        uploadAvatar,
        removeAvatar,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}