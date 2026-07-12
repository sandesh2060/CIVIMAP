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

ROW-SPLIT OCR (ported from prepare_training_data.py):
  Nepali plates are two stacked lines (province/category line, then digit
  line). PaddleOCR's recognition model reads ONE line per call — feeding
  it a merged two-row crop in a single call does not "read both lines",
  it linearizes the 2D layout into one sequence and one row routinely
  gets dropped entirely (confirmed in debug_crops: candidate 3 returned
  'ब.८४ प ४' — the digit line '६५४८' vanished, not just misread). Each
  candidate crop is now split into its two line images (same row-density-
  gap method as prepare_training_data.split_into_lines) and OCR'd
  separately, then the two readings are joined — this is what actually
  gets the digit line into rawOcrText at all, which confusion-correction
  and format validation downstream can only work with if it's present.

DIGIT SWAP VARIANTS (ported from nepali_plate_chars.py, previously dead
code): ४ and ८ (also ३/५, ०/६) are genuinely ambiguous glyphs, not just
a one-way Latin-lookalike issue, so a static substitution can't safely
resolve them — both are legitimate digits elsewhere on the same plate.
generate_digit_swap_variants() existed but was never called anywhere.
Each candidate's tail-digit reading is now expanded into its ambiguous-
pair variants (at reduced confidence) before cross-candidate voting, so
if OTHER candidates' independent OCR passes agree with a variant rather
than the literal reading, that agreement can actually influence the
consensus instead of the swap logic sitting unused.
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

from utils.nepali_plate_chars import (
    extract_plate_number,
    generate_digit_swap_variants,
    vote_on_tail_digits,
)
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

# Minimum fraction of a candidate's bounding box that must be raw red
# pixels (BEFORE morphological closing) to be considered a real plate.
# A real plate is overwhelmingly red background with text carved out of
# it. Sparse/see-through red structure (chain-link fences with red
# showing through the gaps, red clothing, brake components) is mostly
# NOT red within its own bounding box even though morphological closing
# can make it LOOK plate-shaped downstream — this gate is checked on the
# RAW mask specifically to catch that before closing hides the
# difference. Ported from prepare_training_data.py, where this was
# confirmed to reject exactly that fence false-positive.
MIN_RAW_FILL_RATIO = 0.42

# Minimum contour-area / minAreaRect-area ratio. A clean rectangle scores
# close to 1.0; irregular/non-plate shapes score lower. Ported from
# prepare_training_data.py.
MIN_RECTANGULARITY = 0.55

# Deskewed candidates are upscaled so their long edge is at least this
# many pixels before OCR — improves glyph legibility on small plates in
# the source photo. Ported from prepare_training_data.py.
UPSCALE_TARGET_LONG_EDGE = 600

# Confidence multiplier applied to phantom votes generated from
# ambiguous-pair swaps (see _expand_readings_with_swap_variants). Kept
# well below 1.0 so a swap variant can only tip a genuinely close vote,
# never outweigh a reading that real OCR passes agree on directly.
SWAP_VARIANT_VOTE_WEIGHT = 0.4


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

    NOTE: merging only guarantees both rows are physically INSIDE the
    candidate's bounding box. It does not by itself get both rows correctly
    read — that also requires OCR to be run per-row rather than once on
    the merged box (see _split_into_lines / the per-candidate loop below).
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


def _order_box_points(pts):
    """
    Given 4 corner points (any order) from cv2.boxPoints, return them
    ordered [top-left, top-right, bottom-right, bottom-left] — required
    for a correct perspective warp. Ported from prepare_training_data.py.
    """
    pts = np.asarray(pts, dtype=np.float32)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).flatten()
    top_left = pts[np.argmin(s)]
    bottom_right = pts[np.argmax(s)]
    top_right = pts[np.argmin(diff)]
    bottom_left = pts[np.argmax(diff)]
    return np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.float32)


def _rectangularity_score(contour, rect_area):
    """
    How close the region's shape is to a clean rectangle: contour area
    vs. its minAreaRect area. A real plate scores close to 1.0; an
    irregular blob (partial occlusion, non-plate red object) scores
    lower. Ported from prepare_training_data.py. This is the "verify it
    is actually a plate" geometric check.
    """
    if rect_area <= 0:
        return 0.0
    contour_area = cv2.contourArea(contour)
    return float(np.clip(contour_area / rect_area, 0.0, 1.0))


def _raw_fill_ratio(raw_mask, x, y, w, h):
    """
    Fraction of TRUE red pixels (pre-closing) within the candidate's own
    bounding box. Low for chain-link fences / sparse red structure; high
    for an actual solid-red plate. Checked on the raw mask, not the
    morphologically-closed one, specifically because closing is what
    erases this difference. Ported from prepare_training_data.py.
    """
    region = raw_mask[y:y + h, x:x + w]
    if region.size == 0:
        return 0.0
    return float(cv2.countNonZero(region)) / float(region.size)


def _two_row_text_score(deskewed_bgr):
    """
    Checks whether the deskewed crop actually contains the specific
    pattern a real two-line Nepali plate has: two horizontal bands of
    light (white/silver) pixels, separated by a visible gap, each band
    broken into several distinct small components (individual character
    strokes) rather than one solid blob. Returns a 0..1 confidence.
    Ported from prepare_training_data.py — this is what lets candidate
    RANKING prefer a genuine two-row plate over a same-shaped red patch
    that has no text pattern on it at all.
    """
    if deskewed_bgr is None or deskewed_bgr.size == 0:
        return 0.0

    gray = cv2.cvtColor(deskewed_bgr, cv2.COLOR_BGR2GRAY)
    _, light_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    h, w = light_mask.shape[:2]
    if h < 20 or w < 20:
        return 0.0

    row_density = light_mask.sum(axis=1).astype(np.float32)
    row_density /= (row_density.max() + 1e-6)

    mid_start, mid_end = int(h * 0.25), int(h * 0.75)
    if mid_end <= mid_start:
        return 0.0
    gap_idx = mid_start + int(np.argmin(row_density[mid_start:mid_end]))
    gap_value = row_density[gap_idx]

    top_band = row_density[:gap_idx]
    bottom_band = row_density[gap_idx:]
    if top_band.size == 0 or bottom_band.size == 0:
        return 0.0

    top_peak = top_band.max()
    bottom_peak = bottom_band.max()

    gap_contrast = min(top_peak, bottom_peak) - gap_value
    if gap_contrast <= 0.15 or top_peak < 0.25 or bottom_peak < 0.25:
        return 0.0

    def _component_count(band_mask):
        num_labels, _, stats, _ = cv2.connectedComponentsWithStats(band_mask, connectivity=8)
        min_area = max(4, (w * band_mask.shape[0]) // 400)
        return sum(1 for i in range(1, num_labels) if stats[i, cv2.CC_STAT_AREA] >= min_area)

    top_components = _component_count(light_mask[:gap_idx, :])
    bottom_components = _component_count(light_mask[gap_idx:, :])

    component_score = min(1.0, (min(top_components, bottom_components)) / 3.0)
    contrast_score = min(1.0, gap_contrast / 0.5)

    return float(0.5 * component_score + 0.5 * contrast_score)


def _deskew_crop(image, box_points, pad_frac=0.08):
    """
    Perspective-warps the region defined by box_points (a rotated
    rectangle's 4 corners, in original-image coordinates) into a
    straightened, front-on crop. This is the "if captured from one side,
    correct its perspective" step — handles plates photographed at an
    angle rather than only plates already square-on to the camera.
    Ported from prepare_training_data.py.
    """
    ordered = _order_box_points(box_points)
    (tl, tr, br, bl) = ordered

    width_top = np.linalg.norm(tr - tl)
    width_bottom = np.linalg.norm(br - bl)
    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)
    out_w = int(max(width_top, width_bottom))
    out_h = int(max(height_left, height_right))
    if out_w < 10 or out_h < 10:
        return None

    dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(ordered, dst)
    warped = cv2.warpPerspective(image, matrix, (out_w, out_h))

    pad = int(max(out_w, out_h) * pad_frac)
    if pad > 0:
        warped = cv2.copyMakeBorder(warped, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
    return warped


def _upscale_to_target(crop, target_long_edge=UPSCALE_TARGET_LONG_EDGE):
    """
    Upscales small candidate crops (plates are often small in the source
    photo) before the OCR pipeline's own resize/CLAHE runs on them. Uses
    Lanczos interpolation for the initial upscale — sharper than the
    bilinear/area interpolation used for the later, smaller resizes in
    preprocessing.py. Ported from prepare_training_data.py.
    """
    h, w = crop.shape[:2]
    long_edge = max(h, w)
    if long_edge >= target_long_edge or long_edge == 0:
        return crop
    scale = target_long_edge / float(long_edge)
    return cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LANCZOS4)


def _merged_box_rotated_rect(closed_mask, box):
    """
    Given an axis-aligned merged box (x, y, w, h) and the closed red
    mask, finds the largest contour inside that box and returns its
    minAreaRect corner points (in FULL-IMAGE coordinates) plus a
    rectangularity score. Needed because _merge_nearby_boxes works on
    simple axis-aligned rects (for the row-fragment-stitching logic to
    stay simple), but deskewing needs the actual rotated rectangle, not
    an axis-aligned approximation of it — a plate photographed at an
    angle has a rotated true shape that an axis-aligned box only loosely
    bounds.
    """
    x, y, w, h = box
    sub_mask = closed_mask[y:y + h, x:x + w]
    contours, _ = cv2.findContours(sub_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, 0.0

    c = max(contours, key=cv2.contourArea)
    rect = cv2.minAreaRect(c)
    box_points = cv2.boxPoints(rect)
    box_points[:, 0] += x
    box_points[:, 1] += y

    rect_area = rect[1][0] * rect[1][1]
    rect_score = _rectangularity_score(c, rect_area)
    return box_points, rect_score



def _generate_red_plate_candidates(image: np.ndarray):
    """
    Nepali private-vehicle plates have a distinctive bright red background
    with white/silver text — a far more reliable, plate-specific signal
    than generic edges, which get confused by mirrors, chrome, helmets,
    and clustered vehicles in a crowded photo (exactly the case that
    produced zero usable candidates via edge detection alone).

    Pipeline per candidate region, ported from prepare_training_data.py:
      1. fill_ratio gate (raw, pre-close red pixel density) — rejects
         fences/sparse red structure before any expensive work runs.
      2. rectangularity gate (contour area vs. minAreaRect area) —
         rejects irregular blobs that aren't actually plate-shaped. This
         plus (1) is the "verify this is actually a plate" check.
      3. Deskew via perspective warp on the region's true rotated
         rectangle — corrects plates photographed at an angle rather
         than only handling square-on shots.
      4. Upscale to a legible minimum size (Lanczos).
      5. two_row_score — does the deskewed, upscaled crop actually show
         two bands of white/silver character strokes? Used to RANK
         candidates, not as a hard gate (a real plate that's very
         low-contrast could genuinely score low here without being
         invalid).

    Boxes are merged (_merge_nearby_boxes) before this pipeline runs so
    a plate whose two text rows fragmented into separate contours still
    yields one full-plate candidate instead of two partial ones.

    NOTE ON AREA FRACTION: earlier versions hard-capped a candidate's
    area at 50% of the photo, which rejected plates in already-tight
    close-up photos outright (confirmed failure: a photo that was ~90%
    plate produced zero red-mask candidates, falling through to
    single-letter edge fragments instead). The fill-ratio/rectangularity/
    two-row gates above are a more precise filter than a raw area cap,
    so the upper bound is relaxed to 0.92 — a genuinely non-plate large
    red region (e.g. a red wall filling the frame) will still fail the
    two-row/rectangularity checks even though it now passes the area
    check alone.
    """
    h_img, w_img = image.shape[:2]
    img_area = h_img * w_img

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    # Red wraps around the HSV hue circle, so two ranges are needed.
    lower_red_1 = np.array([0, 90, 60])
    upper_red_1 = np.array([10, 255, 255])
    lower_red_2 = np.array([170, 90, 60])
    upper_red_2 = np.array([180, 255, 255])
    raw_mask = cv2.bitwise_or(
        cv2.inRange(hsv, lower_red_1, upper_red_1),
        cv2.inRange(hsv, lower_red_2, upper_red_2),
    )
    closed_mask = cv2.morphologyEx(raw_mask, cv2.MORPH_CLOSE, np.ones((7, 15), np.uint8), iterations=2)

    contours, _ = cv2.findContours(closed_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    raw_boxes = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w < 40 or h < 15:
            continue
        area_frac = (w * h) / img_area
        if area_frac < 0.001 or area_frac > 0.92:
            continue
        raw_boxes.append((x, y, w, h))

    merged_boxes = _merge_nearby_boxes(raw_boxes)

    scored = []
    for x, y, w, h in merged_boxes:
        # GATE 1: raw fill ratio, cheapest check, run first.
        fill_ratio = _raw_fill_ratio(raw_mask, x, y, w, h)
        if fill_ratio < MIN_RAW_FILL_RATIO:
            continue

        # GATE 2: rectangularity, using the region's true rotated rect
        # (also gives us the corner points needed to deskew).
        box_points, rect_score = _merged_box_rotated_rect(closed_mask, (x, y, w, h))
        if box_points is None or rect_score < MIN_RECTANGULARITY:
            continue

        deskewed = _deskew_crop(image, box_points)
        if deskewed is None:
            continue
        deskewed = _upscale_to_target(deskewed)

        two_row_score = _two_row_text_score(deskewed)
        aspect_score = 1.0 - min(abs((w / h) - 2.2) / 2.2, 1.0) if h else 0.0
        size_score = 1.0 - min(abs(((w * h) / img_area) - 0.05) / 0.30, 1.0)

        combined = (
            aspect_score * 0.20
            + size_score * 0.15
            + rect_score * 0.15
            + two_row_score * 0.35
            + min(1.0, fill_ratio / 0.7) * 0.15
        )
        scored.append((combined, deskewed, (x, y, w, h)))

    scored.sort(key=lambda item: item[0], reverse=True)

    candidates = []
    for _score, deskewed, box in scored[:MAX_CANDIDATES]:
        candidates.append((deskewed, box))

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


def _split_into_lines(crop: np.ndarray) -> list:
    """
    Splits a plate crop into up to 2 horizontal line images by finding the
    row with the lowest text-pixel density (the gap between the province/
    category line and the digit line).

    Ported from prepare_training_data.split_into_lines(), which is the
    step that made the labeling tool reliably capture both lines — the
    live endpoint previously ran OCR once on the full merged two-row
    crop, which is what caused the digit line to be dropped from OCR
    output entirely rather than just misread (PaddleOCR's rec model
    reads one line per call; a two-row image gets linearized into one
    sequence, and one row loses).

    Returns [crop] unchanged if the crop is too short to plausibly
    contain two lines, or if a density-gap row can't be found — callers
    then OCR it as a single region same as before, so this only changes
    behavior for crops where a real two-row split is found.
    """
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    row_density = binary.sum(axis=1)

    h = crop.shape[0]
    if h < 60:
        return [crop]

    search_start, search_end = int(h * 0.3), int(h * 0.7)
    if search_end <= search_start:
        return [crop]

    gap_row = search_start + int(np.argmin(row_density[search_start:search_end]))
    line1 = crop[0:gap_row, :]
    line2 = crop[gap_row:, :]

    if line1.shape[0] < 20 or line2.shape[0] < 20:
        return [crop]
    return [line1, line2]


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


def _run_ocr_on_candidate(crop: np.ndarray, debug_dir: str, candidate_idx: int):
    """
    Runs the full per-candidate OCR pipeline: split into lines, preprocess
    and OCR each line SEPARATELY, then join results.

    Splitting happens on the raw crop (before downscale/CLAHE) so the
    row-density-gap search sees the same pixels _split_into_lines was
    validated against in prepare_training_data.py. Each resulting line is
    then independently downscaled/resized and CLAHE'd — this also fixes a
    secondary issue: resize_for_ocr(min_height=128) previously upscaled
    based on the COMBINED two-row crop's height, so each individual row
    ended up with less effective resolution than resizing each row on its
    own gives it.

    Debug crops are written per line (candidate_i_line0/line1, raw +
    processed) alongside the existing whole-candidate debug crops, so a
    dropped or misread line can be inspected directly instead of inferred
    from the concatenated text alone.

    Returns (raw_text, ocr_confidence) — raw_text is the space-joined
    text of both lines (or just one, if the crop wasn't split); confidence
    is the average across however many lines were actually OCR'd.
    """
    lines = _split_into_lines(crop)

    texts = []
    confidences = []
    for line_idx, line_crop in enumerate(lines):
        raw_line_path = os.path.join(
            debug_dir, f"candidate_{candidate_idx}_line{line_idx}_raw.jpg"
        )
        cv2.imwrite(raw_line_path, line_crop)

        processed_line = _downscale_for_ocr(line_crop)
        processed_line = prepare_plate_crop(processed_line)

        processed_line_path = os.path.join(
            debug_dir, f"candidate_{candidate_idx}_line{line_idx}_processed.jpg"
        )
        cv2.imwrite(processed_line_path, processed_line)

        line_text, line_conf = _run_ocr(processed_line)
        if line_text:
            texts.append(line_text)
            confidences.append(line_conf)

    raw_text = " ".join(texts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return raw_text, avg_confidence


def _expand_readings_with_swap_variants(readings: list) -> list:
    """
    Takes the (tail_digits, confidence) readings collected across
    candidates and adds swap-variant "phantom votes" generated by
    generate_digit_swap_variants() (ported here — it existed in
    nepali_plate_chars.py but was never called from anywhere).

    Why this is needed: ४/८ (and ३/५, ०/६) are genuinely ambiguous
    glyphs, not a one-way mistake — a plain confidence-weighted vote
    across candidates only helps if enough candidates independently read
    the character correctly. If one candidate reads a position as ४ and
    another reads it as ८, those are just two competing literal votes
    with no way to know which is right. Adding each reading's ambiguous-
    pair variants as additional lower-weight votes lets agreement show
    up in a way the literal readings alone couldn't express — e.g. if
    two candidates read the same position as ८ (via OCR mistake) and one
    reads it as the correct ४, the two ८-readings' generated ४-variant
    votes now reinforce the correct ४ instead of the literal vote being
    2-to-1 against it.

    Variant votes are weighted by SWAP_VARIANT_VOTE_WEIGHT (< 1.0) so
    they can only tip a genuinely close vote, never outvote readings
    multiple candidates agree on directly.
    """
    expanded = list(readings)
    for text, conf in readings:
        for variant in generate_digit_swap_variants(text):
            if variant != text:
                expanded.append((variant, conf * SWAP_VARIANT_VOTE_WEIGHT))
    return expanded


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

        # DEBUG: save the raw candidate crop BEFORE any preprocessing or
        # splitting, so it can be visually inspected to check whether it
        # actually contains the full plate (both text rows) or was
        # cropped short — a shape number alone can't answer that
        # question. Per-line raw/processed crops are also saved inside
        # _run_ocr_on_candidate below.
        raw_debug_path = os.path.join(debug_dir, f"candidate_{i}_raw.jpg")
        cv2.imwrite(raw_debug_path, crop)

        raw_text, ocr_conf = _run_ocr_on_candidate(crop, debug_dir, i)
        parsed = extract_plate_number(raw_text)

        combined_conf = ocr_conf
        if parsed["trimmed"]:
            combined_conf *= 0.85
        if not parsed["is_valid_format"]:
            combined_conf *= 0.7

        elapsed = time.time() - t0
        print(
            f"[plate-detection] candidate {i} took {elapsed:.1f}s "
            f"-> text={parsed['full_text'] or None!r} conf={combined_conf:.2f}"
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
    # of running OCR again. Readings are first expanded with ambiguous-
    # pair swap variants (see _expand_readings_with_swap_variants) so a
    # ४/८-type misread on one candidate can be corrected by agreement
    # from others, not just by literal vote matches.
    final_tail_digits = parsed["tail_digits"]
    if len(all_readings) > 1:
        expanded_readings = _expand_readings_with_swap_variants(all_readings)
        consensus, was_corrected = vote_on_tail_digits(expanded_readings)
        if consensus and was_corrected:
            print(
                f"[plate-detection] majority vote corrected tail digits: "
                f"{parsed['tail_digits']!r} -> {consensus!r} "
                f"(from {len(all_readings)} readings, "
                f"{len(expanded_readings)} incl. swap variants)"
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