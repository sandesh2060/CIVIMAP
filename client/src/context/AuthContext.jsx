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

// Persisted alongside the session so we know citizen vs admin immediately
// on page refresh, before /auth/me resolves — and so we're not guessing
// based on whether a `role` field happens to exist on the account object
// (the User/citizen model may or may not have one; Admin definitely does,
// but that's not a safe way to *distinguish* the two — see the note this
// replaces in adminLogin below).
const ACCOUNT_TYPE_KEY = "civimap_account_type";

function readStoredAccountType() {
  try {
    const v = localStorage.getItem(ACCOUNT_TYPE_KEY);
    return v === "admin" || v === "citizen" ? v : null;
  } catch {
    return null;
  }
}

function storeAccountType(type) {
  try {
    if (type) localStorage.setItem(ACCOUNT_TYPE_KEY, type);
    else localStorage.removeItem(ACCOUNT_TYPE_KEY);
  } catch {
    // ignore — worst case we fall back to re-deriving after /auth/me
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accountType, setAccountType] = useState(readStoredAccountType); // "citizen" | "admin" | null
  const [initializing, setInitializing] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setAccountType(null);
    storeAccountType(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    (async () => {
      try {
        const res = await api.post("/auth/refresh");
        setAccessToken(res.data.data.accessToken);
        const meRes = await api.get("/auth/me");
        setUser(meRes.data.data.account);
        // accountType was already restored from localStorage in useState's
        // initializer above (if this is a page refresh mid-session), so we
        // don't need /auth/me to tell us the type here.
      } catch {
        clearSession();
      } finally {
        setInitializing(false);
      }
    })();
  }, [clearSession]);

  const requestOtp = useCallback(async (identifier) => {
    const res = await api.post("/auth/otp/request", { identifier });
    return res.data.data;
  }, []);

  const verifyOtp = useCallback(async (identifier, code, deviceId) => {
    const res = await api.post("/auth/otp/verify", { identifier, code, deviceId });
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
    setAccountType("citizen");
    storeAccountType("citizen");
    return res.data.data.user;
  }, []);

  // Admin login — separate email/password flow, distinct from citizen
  // OTP. Hits POST /auth/admin/login (authController.adminLogin), which
  // returns { admin, accessToken } (see sanitizeAdmin in that controller).
  const adminLogin = useCallback(async (email, password) => {
    const res = await api.post("/auth/admin/login", { email, password });
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.admin);
    setAccountType("admin");
    storeAccountType("admin");
    return res.data.data.admin;
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
        accountType, // "citizen" | "admin" | null
        isAdmin: accountType === "admin",
        initializing,
        requestOtp,
        verifyOtp,
        adminLogin,
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