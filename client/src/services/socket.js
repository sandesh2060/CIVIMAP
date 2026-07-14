// file: client/src/services/socket.js
import { io } from "socket.io-client";
import api, { getAccessToken, setAccessToken, setTokenChangeHandler } from "./api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// One shared connection for the whole app. MapPage, ReportsPage, and the
// admin queue all listen on this single socket instead of each opening
// their own — that way room membership (viewport-*, user-<id>, admin-room)
// stays consistent no matter which page mounted it first.
// See server/src/sockets/index.js — auth token is read from handshake.auth.token.
const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  auth: (cb) => cb({ token: getAccessToken() }),
});

// Any time the access token changes anywhere in the app — initial mount
// refresh, OTP verify, silent 401 refresh, password change, or logout —
// force the socket to disconnect and re-handshake so it re-authenticates
// and rejoins its personal room (user-<id>) with a valid token. Without
// this, a socket that connected before a token refresh/expiry stays
// anonymous (or stale) for the rest of the session and silently misses
// events like notification:new.
setTokenChangeHandler((token) => {
  if (socket.connected) {
    socket.disconnect();
  }
  if (token) {
    // A fresh token means we have a live session again — re-enable
    // automatic reconnection in case a previous refresh failure had
    // disabled it (see connect_error handler below).
    socket.io.opts.reconnection = true;
    socket.connect();
  }
});

// Guards against firing multiple overlapping /auth/refresh calls if
// connect_error fires again before the first refresh attempt resolves
// (e.g. the reconnection engine's own backoff retry landing mid-refresh).
let refreshInFlight = null;

socket.on("connect_error", (err) => {
  if (err.message !== "unauthorized") return; // network errors etc. — let socket.io's own backoff handle it

  const staleToken = getAccessToken();
  if (!staleToken) return; // not logged in — nothing to refresh, stay disconnected

  // IMPORTANT: do NOT call socket.connect() here with the same token.
  // The token is actually expired, not just stale-in-memory — retrying
  // with it will fail identically every time, and calling connect()
  // synchronously on every connect_error bypasses socket.io's built-in
  // reconnection backoff entirely, producing a tight infinite retry
  // loop (this was the original bug). Instead, fetch a real new token
  // and let setTokenChangeHandler above perform one clean, deliberate
  // reconnect once we actually have something worth retrying with.
  if (!refreshInFlight) {
    refreshInFlight = api
      .post("/auth/refresh")
      .then((res) => {
        setAccessToken(res.data.data.accessToken); // triggers reconnect via setTokenChangeHandler
      })
      .catch(() => {
        // Refresh failed too — the session is genuinely dead (e.g. the
        // refresh token itself expired, or the user was logged out
        // elsewhere). Stop socket.io's automatic reconnection so it
        // doesn't keep retrying with a token that will never become
        // valid again; a future login will re-enable it via the
        // "reconnection = true" line above.
        socket.io.opts.reconnection = false;
        socket.disconnect();
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
});

export function connectSocket() {
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}

export default socket;