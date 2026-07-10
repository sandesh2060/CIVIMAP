"""
Plate detection + OCR endpoint.

No trained plate-detector model is required. Candidate plate-like regions
are found with classical CV (edge density + contour geometry — plates are
high-contrast rectangles with a roughly known aspect ratio), each candidate
is OCR'd with PaddleOCR (devanagari), and the result is scored using
nepali_plate_chars.extract_plate_number() so confusion-correction and
format validation happen INSIDE candidate selection, not just at the end.

Why this replaces the earlier YOLO-based version:
  - No trained plate-detector weights exist for this project, so YOLO()
    had nothing to load and crashed on import besides.
  - The candidate-crop-then-OCR approach is what was already producing
    real results in production logs (see chat) before that swap — this
    file restores and improves that shape rather than replacing it.

Speed fixes vs. the plain "OCR every candidate" approach that was taking
15-110s per request:
  - Candidates are capped (MAX_CANDIDATES) and sorted by how "plate-like"
    they are geometrically BEFORE any OCR runs, so the most promising ones
    are tried first.
  - Early exit: as soon as a candidate clears CONFIDENCE_EARLY_EXIT, the
    remaining candidates are skipped entirely instead of always running
    all of them.
  - Candidates are downscaled before OCR if they're implausibly large
    (a full 1000px-tall "candidate" spent 20-40s in your logs; OCR does
    not need more than ~300px on the long edge to read plate text).
"""

import os
import time

import certifi
import cv2
import numpy as np
import requests
from fastapi import APIRouter, HTTPException
from paddleocr import PaddleOCR
from pydantic import BaseModel

from utils.nepali_plate_chars import extract_plate_number, vote_on_tail_digits
from utils.preprocessing import prepare_plate_crop

router = APIRouter()

# IMPORTANT: as of PaddleOCR 3.x, the default `ocr_version` resolves to
# PP-OCRv6, a "unified" model that only covers 50 Latin/CJK-adjacent
# languages — Devanagari is NOT among them, which is why lang="devanagari"
# with no ocr_version raised "No models are available for lang='devanagari'".
# Devanagari support lives in the PP-OCRv5 multilingual model group, so we
# name the recognition model explicitly rather than relying on `lang=`
# resolution — this is also more robust against future default-version
# drift than passing lang= alone (see requirements.txt: pin paddleocr
# to avoid this recurring on a future `pip install`).
#
# use_textline_orientation=False: your logs show no evidence of rotated/
# upside-down plates, and orientation classification adds real per-candidate
# latency for no measured benefit here — flip back on if you start seeing
# rotated crops. (This replaces the old `use_angle_cls` param name from
# PaddleOCR 2.x; 3.x keeps use_angle_cls as a back-compat alias, but the
# new name is used here to avoid relying on that mapping.)
_ocr_engine = PaddleOCR(
    text_recognition_model_name="devanagari_PP-OCRv5_mobile_rec",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)

OCR_CONFIDENCE_THRESHOLD = 0.75   # below this -> flagForReview
CONFIDENCE_EARLY_EXIT = 0.85      # stop trying more candidates once hit
MAX_CANDIDATES = 5                # hard cap regardless of how many are found
MAX_OCR_LONG_EDGE = 400           # downscale candidates larger than this before OCR


class PlateDetectionRequest(BaseModel):
    imageUrl: str


def _load_image_from_url(url: str) -> np.ndarray:
    """
    Fetches and decodes an image from a URL.

    Uses `requests` with certifi's CA bundle explicitly (verify=certifi.where())
    rather than urllib's OS trust store. The OS trust store doesn't recognize
    whatever is intercepting HTTPS on this machine/network (a corporate
    proxy, antivirus doing TLS inspection, or a VPN) — that's what
    "self-signed certificate in certificate chain" means: something between
    this machine and Cloudinary is presenting its own cert instead of
    Cloudinary's real one. certifi's bundle is more likely to include that
    intercepting root cert IF it's a common one (e.g. a well-known antivirus
    vendor cert), but if it still fails, the real fix is identifying and
    trusting whatever is doing the interception at the OS level — not
    disabling verification, which would silently accept ANY cert including
    a genuinely malicious one for every future request this service makes.
    """
    try:
        resp = requests.get(url, timeout=15, verify=certifi.where())
        resp.raise_for_status()
    except requests.exceptions.SSLError as e:
        raise HTTPException(
            status_code=502,
            detail=(
                "SSL certificate verification failed fetching the image. "
                "This usually means something on this network/machine "
                "(corporate proxy, antivirus TLS inspection, or a VPN) is "
                "intercepting HTTPS traffic. Identify and trust that "
                "certificate at the OS level rather than disabling "
                f"verification. Original error: {e}"
            ),
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch image: {e}")

    arr = np.frombuffer(resp.content, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image")
    return image


def _plate_likeness_score(w: int, h: int, img_area: int) -> float:
    """
    Cheap geometric heuristic to rank candidate boxes BEFORE running any
    OCR. Nepali plates are wider than tall (roughly 2:1 to 3.5:1 including
    two-line layouts which run closer to 1.3:1), and are a small-to-medium
    fraction of the full photo, not the whole frame and not a speck.
    Higher score = more plate-like, used purely for trial ordering.
    """
    if h == 0:
        return 0.0
    aspect = w / h
    area_frac = (w * h) / img_area

    aspect_score = 1.0 - min(abs(aspect - 2.2) / 2.2, 1.0)
    size_score = 1.0 - min(abs(area_frac - 0.05) / 0.30, 1.0)
    return aspect_score * 0.6 + size_score * 0.4


def _merge_nearby_boxes(boxes: list, max_vertical_gap_ratio: float = 0.8) -> list:
    """
    Merges bounding boxes that likely belong to the SAME physical plate but
    got split into separate contours — typically because the gap between
    the province/category line and the digit line broke the red mask into
    two disconnected blobs. Two boxes are merged if they overlap
    significantly on the x-axis (same horizontal position = same plate,
    not two different objects side by side) AND the vertical gap between
    them is small relative to their height (stacked text rows, not two
    unrelated red regions in the photo).

    This is safety-net logic on top of morphology (MORPH_CLOSE), not a
    replacement for it — mask-level closing may still work for most cases,
    but tuning a single kernel size to bridge every possible row-gap size
    across different photo scales is fragile. Explicit geometric merging
    is robust regardless of how the mask happened to fragment.
    """
    if len(boxes) <= 1:
        return boxes

    def x_overlap_ratio(a, b):
        ax0, _, aw, _ = a
        bx0, _, bw, _ = b
        ax1, bx1 = ax0 + aw, bx0 + bw
        overlap = max(0, min(ax1, bx1) - max(ax0, bx0))
        return overlap / min(aw, bw) if min(aw, bw) > 0 else 0

    def vertical_gap(a, b):
        _, ay0, _, ah = a
        _, by0, _, bh = b
        ay1, by1 = ay0 + ah, by0 + bh
        if ay1 <= by0:
            return by0 - ay1
        if by1 <= ay0:
            return ay0 - by1
        return 0  # already overlapping vertically

    def union(a, b):
        ax0, ay0, aw, ah = a
        bx0, by0, bw, bh = b
        x0, y0 = min(ax0, bx0), min(ay0, by0)
        x1, y1 = max(ax0 + aw, bx0 + bw), max(ay0 + ah, by0 + bh)
        return (x0, y0, x1 - x0, y1 - y0)

    merged = list(boxes)
    changed = True
    while changed:
        changed = False
        for i in range(len(merged)):
            for j in range(i + 1, len(merged)):
                a, b = merged[i], merged[j]
                min_h = min(a[3], b[3])
                if (
                    x_overlap_ratio(a, b) > 0.4
                    and vertical_gap(a, b) < max_vertical_gap_ratio * min_h
                ):
                    merged[i] = union(a, b)
                    del merged[j]
                    changed = True
                    break
            if changed:
                break
    return merged


def _generate_red_plate_candidates(image: np.ndarray):
    """
    Nepali private-vehicle plates have a distinctive bright red background
    with white/silver text — a far more reliable, plate-specific signal
    than generic edges, which get confused by mirrors, chrome, helmets,
    and clustered vehicles in a crowded photo (exactly the case that
    produced zero usable candidates via edge detection alone).

    Returns candidate (crop, box) tuples for contours found in an HSV red
    mask, filtered by plausible plate size/aspect ratio, scored the same
    way as edge-based candidates but with a red-match bonus. Boxes are
    merged (_merge_nearby_boxes) before scoring so a plate whose two text
    rows fragmented into separate contours still yields one full-plate
    candidate instead of two partial ones — this is what was causing the
    digit line to be missing entirely from OCR output.
    """
    h_img, w_img = image.shape[:2]
    img_area = h_img * w_img

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    # Red wraps around the HSV hue circle, so two ranges are needed.
    lower_red_1 = np.array([0, 90, 60])
    upper_red_1 = np.array([10, 255, 255])
    lower_red_2 = np.array([170, 90, 60])
    upper_red_2 = np.array([180, 255, 255])
    mask = cv2.bitwise_or(
        cv2.inRange(hsv, lower_red_1, upper_red_1),
        cv2.inRange(hsv, lower_red_2, upper_red_2),
    )
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 15), np.uint8), iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    raw_boxes = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w < 40 or h < 15:
            continue
        area_frac = (w * h) / img_area
        if area_frac < 0.001 or area_frac > 0.5:
            continue
        raw_boxes.append((x, y, w, h))

    merged_boxes = _merge_nearby_boxes(raw_boxes)

    scored = []
    for x, y, w, h in merged_boxes:
        # Red-match candidates get a flat bonus over the geometric score
        # alone, since the color signal itself is strong evidence.
        score = _plate_likeness_score(w, h, img_area) + 0.5
        scored.append((score, (x, y, w, h)))

    scored.sort(key=lambda item: item[0], reverse=True)

    candidates = []
    for score, (x, y, w, h) in scored[:MAX_CANDIDATES]:
        pad_x, pad_y = int(w * 0.08), int(h * 0.15)
        x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
        x1, y1 = min(w_img, x + w + pad_x), min(h_img, y + h + pad_y)
        crop = image[y0:y1, x0:x1]
        candidates.append((crop, (x0, y0, x1 - x0, y1 - y0)))

    return candidates


def _generate_candidates(image: np.ndarray):
    """
    Combines red-mask candidates (tried first — plate-specific, robust to
    clutter) with edge-based candidates (fallback — catches non-red plates,
    e.g. government/tourist categories with different background colors).
    Deduplicates near-identical boxes and caps the combined list.
    """
    red_candidates = _generate_red_plate_candidates(image)
    edge_candidates = _generate_edge_candidates(image)

    combined = red_candidates + edge_candidates

    # Fallback: if nothing was found by either method, still try the full
    # image once rather than returning zero candidates outright.
    if not combined:
        h_img, w_img = image.shape[:2]
        combined = [(image, (0, 0, w_img, h_img))]

    return combined[:MAX_CANDIDATES]


def _generate_edge_candidates(image: np.ndarray):
    """
    Classical CV candidate generation: edge map -> dilate to merge nearby
    strokes -> contours -> filter to plausible plate-shaped bounding boxes.
    Returns a list of (crop, (x, y, w, h)) sorted best-first by
    _plate_likeness_score, capped at MAX_CANDIDATES.
    """
    h_img, w_img = image.shape[:2]
    img_area = h_img * w_img

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.bilateralFilter(gray, 11, 17, 17)
    edges = cv2.Canny(blurred, 50, 150)
    dilated = cv2.dilate(edges, np.ones((3, 9), np.uint8), iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    scored = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w < 40 or h < 15:
            continue
        area_frac = (w * h) / img_area
        if area_frac < 0.002 or area_frac > 0.6:
            continue
        score = _plate_likeness_score(w, h, img_area)
        scored.append((score, (x, y, w, h)))

    scored.sort(key=lambda item: item[0], reverse=True)

    candidates = []
    for score, (x, y, w, h) in scored[:MAX_CANDIDATES]:
        pad_x, pad_y = int(w * 0.05), int(h * 0.1)
        x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
        x1, y1 = min(w_img, x + w + pad_x), min(h_img, y + h + pad_y)
        crop = image[y0:y1, x0:x1]
        candidates.append((crop, (x0, y0, x1 - x0, y1 - y0)))

    # Fallback: if geometry filtering found nothing usable, still try the
    # full image once rather than returning zero candidates outright.
    if not candidates:
        candidates.append((image, (0, 0, w_img, h_img)))

    return candidates


def _downscale_for_ocr(crop: np.ndarray) -> np.ndarray:
    h, w = crop.shape[:2]
    long_edge = max(h, w)
    if long_edge <= MAX_OCR_LONG_EDGE:
        return crop
    scale = MAX_OCR_LONG_EDGE / float(long_edge)
    return cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def _run_ocr(crop: np.ndarray):
    """
    Returns (raw_text, ocr_confidence) from PaddleOCR on a single crop.

    NOTE: PaddleOCR 3.x's .ocr() call returns a list of dict-like OCRResult
    objects (one per input image), each exposing `rec_texts` (list[str])
    and `rec_scores` (list[float]) as PARALLEL arrays — not the 2.x-era
    per-line [box, (text, conf)] tuples. Parsing this as the old format
    raised "too many values to unpack" since a dict-like object doesn't
    iterate into 2-tuples the way the old nested-list format did.
    """
    result = _ocr_engine.ocr(crop)
    if not result:
        return "", 0.0

    res = result[0]
    try:
        rec_texts = res["rec_texts"]
        rec_scores = res["rec_scores"]
    except (TypeError, KeyError):
        # Fallback for any variant that only exposes .json rather than
        # supporting direct dict-style indexing.
        data = res.json.get("res", res.json) if hasattr(res, "json") else {}
        rec_texts = data.get("rec_texts", [])
        rec_scores = data.get("rec_scores", [])

    if not rec_texts:
        return "", 0.0

    raw_text = " ".join(t for t in rec_texts if t)
    avg_confidence = sum(rec_scores) / len(rec_scores) if rec_scores else 0.0
    return raw_text, avg_confidence


@router.post("/plate-detection")
async def plate_detection(payload: PlateDetectionRequest):
    image = _load_image_from_url(payload.imageUrl)
    candidates = _generate_candidates(image)

    debug_dir = os.path.join(os.path.dirname(__file__), "..", "debug_crops")
    os.makedirs(debug_dir, exist_ok=True)
    print(f"[plate-detection] debug crops will be saved to: {os.path.abspath(debug_dir)}")

    best = None  # (combined_conf, parsed, raw_text, crop_shape)
    all_readings = []  # (tail_digits, combined_conf) for every candidate tried — voting input
    total_start = time.time()

    for i, (crop, _box) in enumerate(candidates):
        t0 = time.time()

        # DEBUG: save the raw candidate crop BEFORE any preprocessing, so
        # it can be visually inspected to check whether it actually
        # contains the full plate (both text rows) or was cropped short —
        # a shape number alone can't answer that question.
        raw_debug_path = os.path.join(debug_dir, f"candidate_{i}_raw.jpg")
        cv2.imwrite(raw_debug_path, crop)

        crop = _downscale_for_ocr(crop)
        crop = prepare_plate_crop(crop)

        # DEBUG: also save the crop AFTER preprocessing (CLAHE + resize),
        # which is literally the pixels PaddleOCR receives — if the raw
        # crop looks fine but the preprocessed one looks broken, the bug
        # is in prepare_plate_crop/_downscale_for_ocr, not the candidate
        # generation.
        processed_debug_path = os.path.join(debug_dir, f"candidate_{i}_processed.jpg")
        cv2.imwrite(processed_debug_path, crop)

        raw_text, ocr_conf = _run_ocr(crop)
        parsed = extract_plate_number(raw_text)

        combined_conf = ocr_conf
        if parsed["trimmed"]:
            combined_conf *= 0.85
        if not parsed["is_valid_format"]:
            combined_conf *= 0.7

        elapsed = time.time() - t0
        print(
            f"[plate-detection] candidate {i} shape={crop.shape} "
            f"took {elapsed:.1f}s -> text={parsed['full_text'] or None!r} "
            f"conf={combined_conf:.2f}"
        )

        if parsed["tail_digits"]:
            all_readings.append((parsed["tail_digits"], combined_conf))

        if best is None or combined_conf > best[0]:
            best = (combined_conf, parsed, raw_text, crop.shape)

        if combined_conf >= CONFIDENCE_EARLY_EXIT:
            break

    print(f"[plate-detection] total elapsed {time.time() - total_start:.1f}s")

    if best is None or not best[1]["full_text"]:
        return {
            "plateText": None,
            "plateNumberDigits": None,
            "confidence": 0.0,
            "croppedImageUrl": None,
            "flagForReview": True,
            "rawOcrText": "",
        }

    combined_conf, parsed, raw_text, _shape = best
    flag_for_review = combined_conf < OCR_CONFIDENCE_THRESHOLD or not parsed["is_valid_format"]

    # Cross-candidate majority vote on the digit tail: multiple candidate
    # crops were already OCR'd above, so this reuses those passes instead
    # of running OCR again. If voting resolves an ambiguous-pair
    # disagreement (e.g. one crop read ४, another read ८ at the same
    # position), the consensus reading replaces the single-best one.
    final_tail_digits = parsed["tail_digits"]
    if len(all_readings) > 1:
        consensus, was_corrected = vote_on_tail_digits(all_readings)
        if consensus and was_corrected:
            print(
                f"[plate-detection] majority vote corrected tail digits: "
                f"{parsed['tail_digits']!r} -> {consensus!r} "
                f"(from {len(all_readings)} readings)"
            )
            final_tail_digits = consensus

    return {
        "plateText": parsed["full_text"],
        "plateNumberDigits": final_tail_digits,
        "confidence": round(combined_conf, 4),
        "croppedImageUrl": None,  # TODO: wire to Cloudinary upload helper
        "flagForReview": flag_for_review,
        "rawOcrText": raw_text,
    }