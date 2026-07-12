import { io } from "socket.io-client";
import { getAccessToken, setTokenChangeHandler } from "./api";

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
    socket.connect();
  }
});

socket.on("connect_error", (err) => {
  // If the server rejected the handshake (e.g. unauthorized due to an
  // expired token that hadn't been refreshed yet), try again with
  // whatever token is currently in memory. If a refresh is in flight
  // elsewhere, this will naturally succeed on a later retry once
  // setTokenChangeHandler fires.
  if (err.message === "unauthorized") {
    const token = getAccessToken();
    if (token) {
      socket.auth = (cb) => cb({ token });
      socket.connect();
    }
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