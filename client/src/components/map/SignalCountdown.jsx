// file: client/src/components/map/SignalCountdown.jsx
import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import socket from "../../services/socket";

const STATE_COLOR = { red: "#DC143C", yellow: "#F59E0B", green: "#16A34A" };

function signalIcon(state, countdown) {
  const color = STATE_COLOR[state] || "#64748B";
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;align-items:center;gap:4px;background:white;border-radius:9999px;padding:2px 8px 2px 4px;box-shadow:0 1px 4px rgba(0,0,0,0.35);border:1px solid rgba(0,0,0,0.08)">
        <span style="display:block;width:10px;height:10px;border-radius:9999px;background:${color}"></span>
        <span style="font-size:11px;font-weight:600;color:#1f2937">${countdown ?? "--"}s</span>
      </div>`,
    iconSize: [50, 22],
    iconAnchor: [25, 11],
  });
}

/**
 * One signal marker. Starts from the initial REST snapshot (GET /api/signals)
 * passed in as `initial`, then live-patches from `signal:update` socket
 * events (README §9) filtered to this signalId — no polling, ticks every
 * second straight from server/src/sockets/signalSocket.js.
 */
export default function SignalCountdown({ initial }) {
  const [signal, setSignal] = useState(initial);

  useEffect(() => {
    const handler = (payload) => {
      if (payload.signalId === initial.signalId) {
        setSignal((prev) => ({ ...prev, ...payload }));
      }
    };
    socket.on("signal:update", handler);
    return () => socket.off("signal:update", handler);
  }, [initial.signalId]);

  if (!signal?.location) return null;

  return (
    <Marker
      position={[signal.location.lat, signal.location.lng]}
      icon={signalIcon(signal.state ?? signal.currentState, signal.countdownSeconds)}
    >
      <Popup>
        <div className="text-sm font-medium">Signal {signal.signalId}</div>
        <div className="text-xs text-muted capitalize">
          {signal.state ?? signal.currentState} · {signal.countdownSeconds}s remaining
        </div>
      </Popup>
    </Marker>
  );
}