// file: client/src/components/map/SignalCountdown.jsx
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import socket from "../../services/socket";
import { toLatLng } from "../../utils/geo";
import { COLORS } from "../../config/tokens";

const STATE_COLOR = { red: COLORS.crimson, yellow: "#FFC72C", green: "#2ECC71" };
const FLASH_THRESHOLD = 5; // seconds — matches real countdown signal behavior

const BADGE_HTML = `
  <div style="position:relative;width:58px;height:64px;display:flex;align-items:center;justify-content:center;">
    <div class="sig-box" style="
      width:52px;height:34px;border-radius:6px;background:#0b0b0d;
      border:2px solid #2a2a2e;box-shadow:0 3px 10px rgba(0,0,0,0.5), inset 0 0 4px rgba(0,0,0,0.8);
      display:flex;align-items:center;justify-content:center;
      transition:opacity 0.08s steps(1);
    ">
      <span class="sig-num-val" style="
        font-family:'Courier New', monospace;
        font-weight:800;
        font-size:22px;
        letter-spacing:1px;
        line-height:1;
        color:#64748B;
      ">--</span>
    </div>
    <div class="sig-tail" style="
      position:absolute;bottom:0;width:0;height:0;
      border-left:6px solid transparent;border-right:6px solid transparent;
      border-top:8px solid #0b0b0d;
    "></div>
  </div>`;

function applyToDom(el, s) {
  if (!el) return;
  const color = STATE_COLOR[s.state] || "#64748B";
  const box = el.querySelector(".sig-box");
  const num = el.querySelector(".sig-num-val");
  if (!num || !box) return;

  num.textContent = s.countdown != null ? Math.max(0, Math.round(s.countdown)) : "--";
  num.style.color = color;
  num.style.textShadow = `0 0 4px ${color}, 0 0 10px ${color}88`;
  box.style.borderColor = `${color}55`;

  const shouldFlash = s.countdown != null && s.countdown <= FLASH_THRESHOLD && s.countdown > 0;
  if (shouldFlash) {
    // hard on/off flash, like real hardware — not a fade
    const on = Math.floor(Date.now() / 400) % 2 === 0;
    box.style.opacity = on ? "1" : "0.25";
  } else {
    box.style.opacity = "1";
  }
}

export default function SignalCountdown({ initial }) {
  const map = useMap();
  const markerRef = useRef(null);
  const stateRef = useRef({
    state: initial.state ?? initial.currentState,
    countdown: initial.countdownSeconds,
    baseline: initial.countdownSeconds || 1,
  });

  const position = toLatLng(initial?.location);

  useEffect(() => {
    if (!position) return;
    const icon = L.divIcon({ className: "", html: BADGE_HTML, iconSize: [58, 64], iconAnchor: [29, 64] });
    const marker = L.marker(position, { icon, zIndexOffset: 900, interactive: true });
    marker.bindPopup("");
    marker.addTo(map);
    markerRef.current = marker;
    applyToDom(marker.getElement(), stateRef.current);
    updatePopup(marker, stateRef.current, initial.signalId);
    return () => {
      map.removeLayer(marker);
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.[0], position?.[1]]);

  // 1s countdown tick
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (s.countdown > 0) {
        s.countdown -= 1;
        applyToDom(markerRef.current?.getElement(), s);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // fast flash tick — only matters in the last FLASH_THRESHOLD seconds,
  // cheap no-op re-render of the DOM the rest of the time
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (s.countdown != null && s.countdown <= FLASH_THRESHOLD && s.countdown > 0) {
        applyToDom(markerRef.current?.getElement(), s);
      }
    }, 400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (payload) => {
      if (payload.signalId !== initial.signalId) return;
      const s = stateRef.current;
      const stateChanged = payload.state !== s.state;
      s.state = payload.state;
      s.countdown = payload.countdownSeconds;
      if (stateChanged || payload.countdownSeconds > s.baseline) {
        s.baseline = Math.max(payload.countdownSeconds, 1);
      }
      applyToDom(markerRef.current?.getElement(), s);
      if (markerRef.current) updatePopup(markerRef.current, s, initial.signalId);
    };
    socket.on("signal:update", handler);
    return () => socket.off("signal:update", handler);
  }, [initial.signalId]);

  return null;
}

function updatePopup(marker, s, signalId) {
  const popup = marker.getPopup();
  if (!popup) return;
  const label = s.state ?? s.currentState;
  popup.setContent(
    `<div style="font-size:13px;font-weight:600;">Signal ${signalId}</div>
     <div style="font-size:11px;color:#6b7280;text-transform:capitalize;">${label} · ${s.countdown}s remaining</div>`
  );
}