// file: client/src/components/map/SignalCountdown.jsx
import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import socket from "../../services/socket";
import { toLatLng } from "../../utils/geo";

const STATE_COLOR = { red: "#DC143C", yellow: "#C89B3C", green: "#1E5631" };

function signalIcon(state, countdown) {
  const color = STATE_COLOR[state] || "#64748B";
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;align-items:center;gap:4px;background:#fff;border-radius:9999px;padding:2px 8px 2px 4px;box-shadow:0 1px 4px rgba(0,0,0,0.35);border:1px solid rgba(0,0,0,0.08)">
        <span style="display:block;width:10px;height:10px;border-radius:9999px;background:${color}"></span>
        <span style="font-size:11px;font-weight:600;color:#1f2937">${countdown ?? "--"}s</span>
      </div>`,
    iconSize: [50, 22],
    iconAnchor: [25, 11],
  });
}

/**
 * Starts from the REST snapshot (`initial`, which HAS location), then
 * live-patches state/countdown from signal:update (which does NOT carry
 * location — see signalSocket.js) without ever losing the marker position.
 */
export default function SignalCountdown({ initial }) {
  const [signal, setSignal] = useState(initial);

  useEffect(() => setSignal(initial), [initial]);

  useEffect(() => {
    const handler = (payload) => {
      if (payload.signalId === initial.signalId) {
        setSignal((prev) => ({ ...prev, state: payload.state, countdownSeconds: payload.countdownSeconds }));
      }
    };
    socket.on("signal:update", handler);
    return () => socket.off("signal:update", handler);
  }, [initial.signalId]);

  const position = toLatLng(signal?.location);
  if (!position) return null;

  return (
    <Marker position={position} icon={signalIcon(signal.state ?? signal.currentState, signal.countdownSeconds)}>
      <Popup>
        <div className="text-sm font-medium">Signal {signal.signalId}</div>
        <div className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
          {(signal.state ?? signal.currentState)} · {signal.countdownSeconds}s remaining
        </div>
      </Popup>
    </Marker>
  );
}