// file : client/src/components/violation/ViolationUpload.jsx
import { useState } from "react";
import api from "../../services/api";

const VIOLATION_TYPES = [
  { value: "red_light", label: "Ran a red light" },
  { value: "no_parking", label: "Parked in a no-parking zone" },
  { value: "wrong_lane", label: "Wrong lane / wrong way" },
  { value: "no_helmet", label: "No helmet" },
  { value: "over_speeding", label: "Over-speeding" },
  { value: "other", label: "Other" },
];

export default function ViolationUpload({ onSubmitted }) {
  const [image, setImage] = useState(null);
  const [violationType, setViolationType] = useState("other");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. Please allow location access.");
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!image) return setError("A photo is required.");
    if (!location) return setError("Please set a location first.");

    const body = new FormData();
    body.append("image", image);
    body.append("violationType", violationType);
    body.append("location", JSON.stringify(location));

    setSubmitting(true);
    try {
      await api.post("/violations", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(true);
      setImage(null);
      setLocation(null);
      onSubmitted?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit violation report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-4 rounded-lg bg-surface2 border border-border text-sm">
        <p className="font-medium text-text mb-1">Violation reported.</p>
        <p className="text-muted text-xs">
          Our AI will read the plate and check it against the registry. If it's a confident
          match, the owner and traffic police are notified automatically. Otherwise it goes to
          an admin for manual confirmation — track its status under "My Reports".
        </p>
        <button
          className="mt-3 text-sm underline"
          onClick={() => setSuccess(false)}
        >
          Report another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-sm font-medium text-text block mb-1">Photo of the vehicle</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          className="w-full text-sm"
        />
        <p className="text-xs text-muted mt-1">
          Make sure the number plate is clearly visible and well-lit — this directly affects
          whether the plate can be read automatically.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-text block mb-1">Violation type</label>
        <select
          value={violationType}
          onChange={(e) => setViolationType(e.target.value)}
          className="w-full h-10 px-3 rounded-lg bg-surface2 border border-border text-sm"
        >
          {VIOLATION_TYPES.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-text block mb-1">Location</label>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="w-full h-10 rounded-lg border border-border text-sm text-left px-3 bg-surface2 disabled:opacity-50"
        >
          {locating
            ? "Getting location…"
            : location
            ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
            : "Use current location"}
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: "var(--np-crimson)" }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting || !image || !location}
        className="w-full h-11 rounded-lg text-white text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--np-crimson)" }}
      >
        {submitting ? "Submitting…" : "Report Violation"}
      </button>
    </form>
  );
}