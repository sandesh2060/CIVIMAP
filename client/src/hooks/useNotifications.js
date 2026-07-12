// file: client/src/hooks/useNotifications.js
import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import socket, { connectSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // The most recent notification pushed live over the socket. Consumers
  // (e.g. LiveNotificationPopup) watch this to show an instant toast the
  // moment it arrives — no reload, no waiting for the next dashboard
  // mount. `_seq` is bumped on every event so identical content arriving
  // twice in a row still re-triggers (plain object equality wouldn't).
  const [incoming, setIncoming] = useState(null);
  const seqRef = useRef(0);
  const fetchedOnce = useRef(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.data.notifications);
      setUnreadCount(res.data.data.unreadCount);
    } catch {
      // silent — notification failures shouldn't break the dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    fetchedOnce.current = true;

    connectSocket();
    const handleNew = (payload) => {
      const notification = payload?.notification;
      seqRef.current += 1;
      // Broadcasts arrive as a lightweight { type, title, message } shape
      // without a persisted _id/isRead — still valid enough to pop a toast.
      setIncoming(notification ? { ...notification, _seq: seqRef.current } : null);
      // Still refetch so the bell badge / list stay authoritative.
      fetchNotifications();
    };
    socket.on("notification:new", handleNew);
    return () => socket.off("notification:new", handleNew);
  }, [user, fetchNotifications]);

  const clearIncoming = useCallback(() => setIncoming(null), []);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      fetchNotifications(); // reconcile on failure
    }
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.patch("/notifications/read-all");
    } catch {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    incoming,
    clearIncoming,
    markRead,
    markAllRead,
    refetch: fetchNotifications,
  };
}