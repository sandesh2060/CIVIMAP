import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

let accessToken = null;
let onUnauthorized = () => {};
let onTokenChange = () => {};

export function setAccessToken(token) {
  accessToken = token;
  onTokenChange(token);
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export function setTokenChangeHandler(fn) {
  onTokenChange = fn;
}

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  // Tells the server which language to render server-generated content in
  // (currently: OTP emails). Read directly from localStorage rather than
  // React context, since this file has no component tree to hook into and
  // LanguageContext already persists here under the same key ("lang").
  // Works pre-login too, which is the whole point — the OTP email needs
  // the *current* toggle state, not the DB-saved languagePref that only
  // exists (and only gets set) after a citizen has visited Settings.
  const lang = localStorage.getItem("lang");
  if (lang === "en" || lang === "ne") {
    config.headers["X-Lang"] = lang;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    const isAuthRoute = original?.url?.includes("/auth/");
    if (status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api
            .post("/auth/refresh")
            .then((res) => {
              const token = res.data.data.accessToken;
              setAccessToken(token);
              return token;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        setAccessToken(null);
        onUnauthorized();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;