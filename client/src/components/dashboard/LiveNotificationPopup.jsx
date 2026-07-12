// file: client/src/components/dashboard/LiveNotificationPopup.jsx
import { useEffect, useState } from "react";
import { useNotifications } from "../../hooks/useNotifications";
import Toast from "../ui/Toast";

// Mount this once, high in the tree (see DashboardLayout below), so any
// notification pushed live over the socket — e.g. "your vehicle was
// reported" — pops up as a glass modal the instant it arrives, on
// whatever page the citizen currently has open. No reload, no waiting
// for the next dashboard mount.
//
// Note: this can occasionally show alongside FirstLoginNotificationModal
// if a live event fires in the same instant the dashboard mounts — that
// overlap is harmless (both just call markRead/markAllRead) and rare in
// practice, since FirstLoginNotificationModal only fires once per browser
// session on initial load.
export default function LiveNotificationPopup() {
  const { incoming, clearIncoming, markRead } = useNotifications();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!incoming) return;
    setToast({
      type: mapType(incoming.type),
      title: incoming.title,
      message: incoming.message,
      _id: incoming._id,
    });
  }, [incoming]);

  function handleClose() {
    if (toast?._id) markRead(toast._id);
    setToast(null);
    clearIncoming();
  }

  return <Toast toast={toast} onClose={handleClose} />;
}

function mapType(type) {
  // Keep this in sync with Notification.type values on the server
  // (notificationService.js). Everything defaults to the neutral "info"
  // (blue) styling — matching the original FirstLoginNotificationModal's
  // blue "Mark all read" button — rather than the alarming crimson
  // "error" style, since none of these represent something going wrong
  // for the recipient.
  switch (type) {
    default:
      return "info";
  }
}