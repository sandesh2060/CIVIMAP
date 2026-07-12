// file : client/src/components/violation/ViolationUpload.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import api from "../../services/api";
import Toast from "../ui/Toast";
import { useLang } from "../../i18n/LanguageContext";

const VIOLATION_TYPES = [
  { value: "red_light", label: "Ran a red light" },
  { value: "no_parking", label: "Parked in a no-parking zone" },
  { value: "wrong_lane", label: "Wrong lane / wrong way" },
  { value: "no_helmet", label: "No helmet" },
  { value: "over_speeding", label: "Over-speeding" },
  { value: "other", label: "Other" },
];

// Steps: pick -> crop -> detecting -> confirm -> (submitting) -> success
const STEP = {
  PICK: "pick",
  CROP: "crop",
  DETECTING: "detecting",
  CONFIRM: "confirm",
  SUCCESS: "success",
};

export default function ViolationUpload({ onSubmitted }) {
  const { t } = useLang();
  const [step, setStep] = useState(STEP.PICK);
  const [originalImage, setOriginalImage] = useState(null); // File
  const [imageObjectUrl, setImageObjectUrl] = useState(null);
  const [croppedBlob, setCroppedBlob] = useState(null);

  const [violationType, setViolationType] = useState("other");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  const [preview, setPreview] = useState(null); // { imageUrl, imagePublicId, plateText, confidence, detectionFailed }
  const [plateInput, setPlateInput] = useState("");
  const [plateConfirmed, setPlateConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { type, message } — for modal-level notices like self-report

  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }); // fractions of image size
  const dragState = useRef(null);

  useEffect(() => {
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageObjectUrl]);

  function handleFilePicked(file) {
    if (!file) return;
    setOriginalImage(file);
    setImageObjectUrl(URL.createObjectURL(file));
    setCrop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    setStep(STEP.CROP);
  }

  // ---- crop box dragging (simple corner/move handles, no dependency) ----
  function startDrag(handle, e) {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    dragState.current = { handle, startX: point.clientX, startY: point.clientY, startCrop: { ...crop } };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onDrag, { passive: false });
    window.addEventListener("touchend", endDrag);
  }

  const onDrag = useCallback((e) => {
    if (!dragState.current || !imgRef.current) return;
    e.preventDefault?.();
    const point = e.touches ? e.touches[0] : e;
    const rect = imgRef.current.getBoundingClientRect();
    const dx = (point.clientX - dragState.current.startX) / rect.width;
    const dy = (point.clientY - dragState.current.startY) / rect.height;
    const { handle, startCrop } = dragState.current;

    setCrop((prev) => {
      let { x, y, w, h } = startCrop;
      const clamp01 = (v) => Math.min(1, Math.max(0, v));

      if (handle === "move") {
        x = clamp01(startCrop.x + dx);
        y = clamp01(startCrop.y + dy);
        x = Math.min(x, 1 - w);
        y = Math.min(y, 1 - h);
      } else if (handle === "se") {
        w = clamp01(startCrop.w + dx);
        h = clamp01(startCrop.h + dy);
      } else if (handle === "nw") {
        const newX = clamp01(startCrop.x + dx);
        const newY = clamp01(startCrop.y + dy);
        w = startCrop.w + (startCrop.x - newX);
        h = startCrop.h + (startCrop.y - newY);
        x = newX;
        y = newY;
      }
      w = Math.max(0.1, Math.min(w, 1 - x));
      h = Math.max(0.1, Math.min(h, 1 - y));
      return { x, y, w, h };
    });
  }, []);

  function endDrag() {
    dragState.current = null;
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
    window.removeEventListener("touchmove", onDrag);
    window.removeEventListener("touchend", endDrag);
  }

  function produceCroppedBlob() {
    return new Promise((resolve) => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return resolve(null);

      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const sx = crop.x * naturalW;
      const sy = crop.y * naturalH;
      const sw = crop.w * naturalW;
      const sh = crop.h * naturalH;

      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }

  async function handleConfirmCrop() {
    setError(null);
    const blob = await produceCroppedBlob();
    if (!blob) {
      setError("Couldn't crop the image — try again.");
      return;
    }
    setCroppedBlob(blob);
    setStep(STEP.DETECTING);

    const body = new FormData();
    body.append("image", blob, "plate-crop.jpg");

    try {
      const { data } = await api.post("/violations/detect-preview", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const result = data.data ?? data; // tolerate either response shape
      setPreview(result);
      setPlateInput(result.plateText || "");
      setPlateConfirmed(false);
      setStep(STEP.CONFIRM);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't run plate detection. You can still enter it manually.");
      setPreview({ imageUrl: null, imagePublicId: null, plateText: null, confidence: 0, detectionFailed: true });
      setPlateInput("");
      setStep(STEP.CONFIRM);
    }
  }

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

    if (!location) return setError("Please set a location first.");
    if (!plateConfirmed) return setError("Please confirm the plate number is correct before submitting.");

    const body = new FormData();
    body.append("violationType", violationType);
    body.append("location", JSON.stringify(location));

    // Always attach the cropped photo file, even when we're about to
    // tell the server to reuse the already-uploaded preview image
    // instead. The upload middleware on this route expects a file to be
    // present; the controller ignores req.file whenever previewImageUrl
    // is also present, so this doesn't cause a second Cloudinary upload
    // — it just satisfies the middleware.
    if (croppedBlob) {
      body.append("image", croppedBlob, "plate-crop.jpg");
    }

    if (preview?.imageUrl && preview?.imagePublicId) {
      body.append("previewImageUrl", preview.imageUrl);
      body.append("previewImagePublicId", preview.imagePublicId);
      body.append("confirmedPlateNumber", plateInput.trim());
      body.append("confirmedConfidence", String(preview.confidence ?? 0));
    } else if (!croppedBlob) {
      return setError("Something went wrong with the photo — please start over.");
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/violations", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // ApiResponse envelope is always { success, message, data }
      const payload = data.data ?? {};

      if (payload.selfReport) {
        // The server returns 201 for this case — it's a valid, handled
        // outcome, not an HTTP error — so axios resolves instead of
        // throwing. We check the payload ourselves before treating this
        // as a normal success, otherwise the citizen sees the generic
        // "Violation reported." screen for a report that was actually
        // rejected. We use our own translated copy here (rather than
        // the server's English-only message) so this respects the
        // site's language toggle.
        setToast({ type: "error", message: t("violations.selfReportError") });
        return; // stop here — do NOT resetAll() / do NOT show STEP.SUCCESS
      }

      resetAll();
      setStep(STEP.SUCCESS);
      onSubmitted?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit violation report.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setOriginalImage(null);
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    setImageObjectUrl(null);
    setCroppedBlob(null);
    setPreview(null);
    setPlateInput("");
    setPlateConfirmed(false);
    setLocation(null);
  }

  function startAnotherReport() {
    setStep(STEP.PICK);
  }

  if (step === STEP.SUCCESS) {
    return (
      <div className="p-4 rounded-lg bg-surface2 border border-border text-sm">
        <p className="font-medium text-text mb-1">Violation reported.</p>
        <p className="text-muted text-xs">
          You confirmed the plate before submitting. If it's a confident registry match, the
          owner and traffic police are notified automatically. Otherwise it goes to an admin for
          manual confirmation — track its status under "My Reports".
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
        <Toast toast={toast} onClose={() => setToast(null)} />
        <div>
          <label className="text-sm font-medium text-text block mb-1">Photo of the vehicle</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFilePicked(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <p className="text-xs text-muted mt-1">
            After picking a photo, you'll be able to crop in on just the number plate before we
            read it.
          </p>
        </div>
        {error && <p className="text-xs" style={{ color: "var(--np-crimson)" }}>{error}</p>}
      </div>
    );
  }

  // ---- Step 2: crop to plate ----
  if (step === STEP.CROP) {
    return (
      <div className="space-y-3">
        <Toast toast={toast} onClose={() => setToast(null)} />
        <p className="text-sm font-medium text-text">Crop in on the number plate</p>
        <p className="text-xs text-muted">
          Drag the box so it tightly frames just the plate — a tighter, well-lit crop reads more
          accurately.
        </p>
        <div className="relative select-none touch-none rounded-lg overflow-hidden border border-border">
          <img
            ref={imgRef}
            src={imageObjectUrl}
            alt="Vehicle"
            className="w-full block"
            draggable={false}
          />
          <div
            onMouseDown={(e) => startDrag("move", e)}
            onTouchStart={(e) => startDrag("move", e)}
            className="absolute border-2 cursor-move"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
              borderColor: "var(--np-crimson)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            }}
          >
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                startDrag("nw", e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                startDrag("nw", e);
              }}
              className="absolute -left-2 -top-2 w-4 h-4 rounded-full cursor-nwse-resize"
              style={{ background: "var(--np-crimson)" }}
            />
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                startDrag("se", e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                startDrag("se", e);
              }}
              className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full cursor-nwse-resize"
              style={{ background: "var(--np-crimson)" }}
            />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />

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
            type="button"
            onClick={handleConfirmCrop}
            className="flex-1 h-11 rounded-lg text-white text-sm font-medium"
            style={{ background: "var(--np-crimson)" }}
          >
            Use this crop
          </button>
        </div>
      </div>
    );
  }

  // ---- Step 3: detecting ----
  if (step === STEP.DETECTING) {
    return (
      <div className="p-6 rounded-lg bg-surface2 border border-border text-sm text-center text-muted">
        Reading the plate…
      </div>
    );
  }

  // ---- Step 4: confirm plate + fill remaining fields + submit ----
  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium text-text block mb-1">Detected plate number</label>
          {preview?.detectionFailed && (
            <p className="text-xs mb-1" style={{ color: "var(--np-crimson)" }}>
              Automatic detection didn't work on this photo — please type the plate manually.
            </p>
          )}
          <input
            type="text"
            value={plateInput}
            onChange={(e) => {
              setPlateInput(e.target.value);
              setPlateConfirmed(false);
            }}
            placeholder="e.g. बा ७२ प ६४१"
            className="w-full h-10 px-3 rounded-lg bg-surface2 border border-border text-sm"
          />
          {!preview?.detectionFailed && (
            <p
              className="text-xs mt-1"
              style={{ color: (preview?.confidence ?? 0) < 0.7 ? "var(--np-crimson)" : undefined }}
            >
              AI confidence: {Math.round((preview?.confidence ?? 0) * 100)}%
              {(preview?.confidence ?? 0) < 0.7 ? " — this read is uncertain, please double-check every character against the photo below." : ". Check it against the photo below and correct it if it's wrong."}
            </p>
          )}

          <label className="flex items-center gap-2 mt-2 text-xs text-text">
            <input
              type="checkbox"
              checked={plateConfirmed}
              onChange={(e) => setPlateConfirmed(e.target.checked)}
              disabled={!plateInput.trim()}
            />
            This plate number is correct
          </label>
        </div>

        {imageObjectUrl && (
          <img
            src={imageObjectUrl}
            alt="Cropped plate reference"
            className="w-full rounded-lg border border-border max-h-40 object-contain bg-black/5"
          />
        )}

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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep(STEP.PICK)}
            className="flex-1 h-11 rounded-lg border border-border text-sm font-medium"
          >
            Start over
          </button>
          <button
            type="submit"
            disabled={submitting || !plateConfirmed || !location}
            className="flex-1 h-11 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--np-crimson)" }}
          >
            {submitting ? "Submitting…" : "Report Violation"}
          </button>
        </div>
      </form>
    </>
  );
}