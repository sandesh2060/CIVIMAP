// file: client/src/services/socket.js
import { io } from "socket.io-client";
import { getAccessToken } from "./api";

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

export function connectSocket() {
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}

export default socket;