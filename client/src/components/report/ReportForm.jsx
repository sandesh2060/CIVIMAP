// file : client/src/components/report/ReportForm.jsx
import { useState, useEffect } from "react";
import api from "../../services/api";

const CATEGORIES = [
  { value: "pothole", label: "Pothole" },
  { value: "streetlight", label: "Streetlight" },
  { value: "garbage", label: "Garbage" },
  { value: "water_leak", label: "Water leak" },
  { value: "civic_other", label: "Other civic issue" },
];

// Steps: pick -> details -> success
// (No crop/AI-preview step here, unlike ViolationUpload — road-issue
// verification happens server-side after submit, not before it. README §3.4.)
const STEP = {
  PICK: "pick",
  DETAILS: "details",
  SUCCESS: "success",
};

export default function ReportForm({ onSubmitted }) {
  const [step, setStep] = useState(STEP.PICK);
  const [image, setImage] = useState(null); // File
  const [imageObjectUrl, setImageObjectUrl] = useState(null);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("civic_other");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageObjectUrl]);

  function handleFilePicked(file) {
    if (!file) return;
    setImage(file);
    setImageObjectUrl(URL.createObjectURL(file));
    setStep(STEP.DETAILS);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't available on this device.");
      return;
    }
    setLocating(true);
    setError(null);
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

  function resetAll() {
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    setImage(null);
    setImageObjectUrl(null);
    setDescription("");
    setCategory("civic_other");
    setLocation(null);
  }

  function startAnotherReport() {
    setStep(STEP.PICK);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!image) return setError("Please attach a photo first.");
    if (!description.trim()) return setError("Please add a short description.");
    if (!location) return setError("Please set a location first.");

    const body = new FormData();
    body.append("image", image);
    body.append("description", description.trim());
    body.append("category", category);
    body.append("location", JSON.stringify(location));

    setSubmitting(true);
    try {
      await api.post("/reports", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      resetAll();
      setStep(STEP.SUCCESS);
      onSubmitted?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === STEP.SUCCESS) {
    return (
      <div className="p-4 rounded-lg bg-surface2 border border-border text-sm">
        <p className="font-medium text-text mb-1">Report submitted.</p>
        <p className="text-muted text-xs">
          Our AI checks it automatically — clear photos usually get approved and appear on the
          map right away. Otherwise it goes to an admin for review. Track its status under
          "My Reports".
        </p>
        <button className="mt-3 text-sm underline" onClick={startAnotherReport}>
          Report another
        </button>
      </div>
    );
  }

  // ---- Step 1: pick a photo ----
  if (step === STEP.PICK) {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-text block mb-1">Photo of the issue</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <p className="text-xs text-muted mt-1">
            A clear, well-lit photo gets verified fastest.
          </p>
        </div>
        {error && <p className="text-xs" style={{ color: "var(--np-crimson)" }}>{error}</p>}
      </div>
    );
  }

  // ---- Step 2: details + location + submit ----
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {imageObjectUrl && (
        <img
          src={imageObjectUrl}
          alt="Reported issue"
          className="w-full rounded-lg border border-border max-h-48 object-cover bg-black/5"
        />
      )}

      <div>
        <label className="text-sm font-medium text-text block mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full h-10 px-3 rounded-lg bg-surface2 border border-border text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-text block mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the issue (e.g. deep pothole blocking the left lane)"
          className="w-full px-3 py-2 rounded-lg bg-surface2 border border-border text-sm"
        />
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStep(STEP.PICK)}
          className="flex-1 h-11 rounded-lg border border-border text-sm font-medium"
        >
          Retake photo
        </button>
        <button
          type="submit"
          disabled={submitting || !location || !description.trim()}
          className="flex-1 h-11 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--np-crimson)" }}
        >
          {submitting ? "Submitting…" : "Report Issue"}
        </button>
      </div>
    </form>
  );
}