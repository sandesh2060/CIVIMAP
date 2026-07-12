// file: client/src/components/map/PlacePin.jsx
import { useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { toLatLng } from "../../utils/geo";

const CATEGORY_COLOR = {
  hospital: "#DC143C",
  school: "#003893",
  tourist: "#1E5631",
  sensitive: "#C89B3C",
  report: "#F59E0B",
  violation: "#DC143C",
};

function dotIcon(color) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function PlacePin({ kind = "place", data, onOpen }) {
  const [opened, setOpened] = useState(false);
  const category = kind === "place" ? data.category : kind;
  const color = CATEGORY_COLOR[category] || "#64748B";
  const position = toLatLng(data.location);
  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={dotIcon(color)}
      eventHandlers={{
        popupopen: () => {
          setOpened(true);
          onOpen?.(data);
        },
      }}
    >
      <Popup minWidth={200}>
        {kind === "place" ? (
          <div className="space-y-1">
            <div className="font-semibold" style={{ color: "var(--text)" }}>{data.name}</div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              {data.category}
            </div>
            {data.description && (
              <p className="text-sm" style={{ color: "var(--text)" }}>{data.description}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="font-semibold capitalize" style={{ color: "var(--text)" }}>{kind} report</div>
            {data.description && <p className="text-sm" style={{ color: "var(--text)" }}>{data.description}</p>}
            {data.imageUrl && (
              <img src={data.imageUrl} alt={kind} className="w-full h-24 object-cover rounded" />
            )}
            {opened && typeof data.aiConfidence === "number" && (
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span>AI confidence</span>
                  <span>{Math.round(data.aiConfidence * 100)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(data.aiConfidence * 100)}%`,
                      background: data.aiConfidence >= 0.85 ? "#1E5631" : "#C89B3C",
                    }}
                  />
                </div>
              </div>
            )}
            <div className="text-[11px] capitalize" style={{ color: "var(--text-muted)" }}>
              status: {data.status}
            </div>
          </div>
        )}
      </Popup>
    </Marker>
  );
}