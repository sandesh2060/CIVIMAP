"""
prepare_training_data.py

Interactive tool to turn real vehicle photos into a labeled dataset for
fine-tuning PaddleOCR's devanagari_PP-OCRv5_mobile_rec recognition model.

WHY THIS EXISTS: fine-tuning needs ground-truth-labeled single-LINE crops
(not whole-plate images) in PaddleOCR's label format:
    train_data/lines/001.jpg<TAB>बा.४४ प
This script automates the tedious parts (finding the plate, splitting it
into its two lines) so you only have to do the part that can't be
automated: typing the CORRECT text for each line, verified against the
photo.

USAGE:
    python3 prepare_training_data.py --input-dir ./raw_photos --output-dir ./train_data

    Re-running the same command SKIPS any photo you already finished
    (labeled or explicitly skipped) last time — see "resume behavior"
    below. To force re-processing everything from scratch:
    python3 prepare_training_data.py --input-dir ./raw_photos --output-dir ./train_data --reset

WORKFLOW PER IMAGE:
    1. Script finds candidate plate-like regions and scores each one on
       FIVE signals, not just red-color match (see "candidate scoring"
       below) — this is what keeps taillights, red jackets, helmets,
       brake components, AND chain-link fences with red showing through
       them from being mistaken for a plate.
    2. The best candidate is deskewed (perspective-corrected to a
       front-on rectangle) and upscaled before you ever see it, so the
       preview you're judging is as readable as the source photo allows.
    3. Shows you the crop. You confirm it's the plate (or skip/retry with
       the next candidate).
    4. Script auto-splits the crop into up to 2 lines via horizontal
       projection profile (finds the row with the least text-pixel
       density = the gap between lines).
    5. You type the correct text for each line (copy from the photo,
       don't guess — this IS the ground truth the model will learn from).
       If you accidentally type 'y' or anything else that isn't the
       actual plate text, that becomes a corrupted training label — when
       in doubt, leave it blank and press Enter to skip that line instead
       of guessing.
    6. Crop + label are saved; label file is appended incrementally so
       you can stop and resume anytime.

RESUME BEHAVIOR:
    Every image you finish (whether it produced labels or you explicitly
    typed 's' to skip it) is recorded by filename in
    train_data/done_images.txt. On the next run, any image already in
    that file is skipped automatically WITHOUT re-showing you a preview
    or re-asking anything — this is what stops re-running the script from
    re-litigating photos you already handled. Pass --reset to wipe that
    tracking and start over from image 1 (your existing labels.txt is
    NOT deleted by --reset, only the "what have I already looked at"
    tracking is).

CANDIDATE SCORING (why a red blob alone is no longer enough):
    Earlier versions treated any large-enough red region as a plate
    candidate. In practice this also matches taillights, red jackets,
    helmets, brake calipers, painted walls/doors, and — confirmed in
    testing — chain-link fences with something red visible through the
    gaps. Each candidate is now scored on FIVE independent signals and
    only the combination is trusted:
      1. fill_score     — HARD GATE, checked first. What fraction of the
                           candidate's bounding box is actually red,
                           BEFORE any morphological closing fills in
                           gaps. A real plate is almost entirely red
                           background (fill ratio typically >0.6) with
                           only the text carved out of it. A chain-link
                           fence with red bleeding through the diamond
                           gaps has a LOW raw fill ratio (mostly metal
                           wire, red only in small gaps) — this is what
                           was previously fooling the detector, since
                           morphological closing merges those gaps back
                           together into something that then looks
                           plate-shaped downstream. Candidates below the
                           fill threshold are rejected immediately,
                           before the more expensive checks run.
      2. aspect_score    — plate-like width:height ratio
      3. size_score      — plausible fraction of the photo
      4. rect_score      — how close the red region's shape is to a
                           clean rectangle (contour area / minAreaRect
                           area).
      5. two_row_score    — does the region actually contain TWO
                           separated horizontal bands of light-colored
                           (white/silver) blobs, each band made of
                           several distinct small components (character
                           strokes)?

REQUIRES: opencv-python, numpy (already in your ai-service venv)
"""

import argparse
import glob
import os

import cv2
import numpy as np

MAX_CANDIDATES = 5
UPSCALE_TARGET_LONG_EDGE = 600  # deskewed candidate is upscaled so its
                                 # long edge is at least this many pixels
                                 # before you're asked to read it.

# Minimum fraction of a candidate's bounding box that must be raw red
# pixels (BEFORE morphological closing) to even be considered further.
# A real plate is overwhelmingly red background with text carved out of
# it. A chain-link fence with red showing through the gaps is mostly
# NOT red within its own bounding box — this is the concrete, cheap gate
# that rejects that exact false positive before any deskew/pattern work.
MIN_RAW_FILL_RATIO = 0.42


# ---------------------------------------------------------------------------
# Candidate geometry helpers
# ---------------------------------------------------------------------------

def _order_box_points(pts):
    """
    Given 4 corner points (any order) from cv2.boxPoints, return them
    ordered [top-left, top-right, bottom-right, bottom-left] — required
    for a correct perspective warp.
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
    contour area vs. its minAreaRect area (measured on the CLOSED mask,
    same as before). A clean rectangle scores close to 1.0.
    """
    if rect_area <= 0:
        return 0.0
    contour_area = cv2.contourArea(contour)
    return float(np.clip(contour_area / rect_area, 0.0, 1.0))


def _raw_fill_ratio(raw_mask, x, y, w, h):
    """
    Fraction of TRUE red pixels (pre-closing) within the candidate's own
    bounding box. Low for chain-link fences (mostly wire, red only in
    small diamond gaps) and other sparse/see-through red structure; high
    for an actual solid-red plate. This is checked on the ORIGINAL mask,
    not the morphologically-closed one, specifically because closing is
    what erases the difference between "solid red plate" and "mostly-
    metal fence with red gaps" by filling the gaps back in.
    """
    region = raw_mask[y:y + h, x:x + w]
    if region.size == 0:
        return 0.0
    return float(cv2.countNonZero(region)) / float(region.size)


def _plate_likeness_score(w, h, img_area):
    if h == 0:
        return 0.0
    aspect = w / h
    area_frac = (w * h) / img_area
    aspect_score = 1.0 - min(abs(aspect - 2.2) / 2.2, 1.0)
    size_score = 1.0 - min(abs(area_frac - 0.05) / 0.30, 1.0)
    return aspect_score, size_score


def _deskew_crop(image, box_points, pad_frac=0.08):
    """
    Perspective-warps the region defined by box_points (a rotated
    rectangle's 4 corners, in original-image coordinates) into a
    straightened, front-on crop.
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
    h, w = crop.shape[:2]
    long_edge = max(h, w)
    if long_edge >= target_long_edge or long_edge == 0:
        return crop
    scale = target_long_edge / float(long_edge)
    return cv2.resize(crop, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LANCZOS4)


def _two_row_text_score(deskewed_bgr):
    """
    Checks whether the deskewed crop actually contains the specific
    pattern a real Nepali plate has: two horizontal bands of light
    (white/silver) pixels, separated by a visible gap, with each band
    broken into several distinct small components (individual character
    strokes) rather than being one solid blob. Returns a 0..1 confidence.
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


def find_plate_candidates(image):
    """
    Returns a list of deskewed_upscaled_crop, sorted best-first, capped
    at MAX_CANDIDATES. Candidates that fail the raw fill-ratio gate
    (fences, sparse red structure) are rejected before any further work.
    """
    h_img, w_img = image.shape[:2]
    img_area = h_img * w_img

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    raw_mask = cv2.bitwise_or(
        cv2.inRange(hsv, np.array([0, 90, 60]), np.array([10, 255, 255])),
        cv2.inRange(hsv, np.array([170, 90, 60]), np.array([180, 255, 255])),
    )
    closed_mask = cv2.morphologyEx(raw_mask, cv2.MORPH_CLOSE, np.ones((7, 15), np.uint8), iterations=2)
    contours, _ = cv2.findContours(closed_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    scored_candidates = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w < 40 or h < 15:
            continue
        area_frac = (w * h) / img_area
        if not (0.001 < area_frac < 0.5):
            continue

        # HARD GATE, checked first and cheaply: is this bounding box
        # actually mostly red, or mostly something else with red only
        # peeking through gaps (fence, grille, mesh)? Measured on the
        # RAW mask, before closing merged any gaps shut.
        fill_ratio = _raw_fill_ratio(raw_mask, x, y, w, h)
        if fill_ratio < MIN_RAW_FILL_RATIO:
            continue

        rect = cv2.minAreaRect(c)
        box_points = cv2.boxPoints(rect)
        rect_area = rect[1][0] * rect[1][1]

        rect_score = _rectangularity_score(c, rect_area)
        if rect_score < 0.55:
            continue

        aspect_score, size_score = _plate_likeness_score(w, h, img_area)

        deskewed = _deskew_crop(image, box_points)
        if deskewed is None:
            continue
        deskewed = _upscale_to_target(deskewed)

        two_row_score = _two_row_text_score(deskewed)

        combined = (
            aspect_score * 0.20
            + size_score * 0.15
            + rect_score * 0.15
            + two_row_score * 0.35
            + min(1.0, fill_ratio / 0.7) * 0.15  # solid-red plates score
                                                   # near 1.0 here; this
                                                   # also lets a genuinely
                                                   # solid, well-shaped,
                                                   # two-row candidate
                                                   # outrank a marginal
                                                   # near-threshold one.
        )
        scored_candidates.append((combined, deskewed))

    scored_candidates.sort(key=lambda item: item[0], reverse=True)
    return [crop for _score, crop in scored_candidates[:MAX_CANDIDATES]]


def split_into_lines(crop):
    """
    Splits a plate crop into up to 2 horizontal line images by finding the
    row with the lowest text-pixel density (the gap between the province/
    category line and the digit line). Returns [line1] or [line1, line2].
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


# ---------------------------------------------------------------------------
# Done-image tracking (resume behavior)
# ---------------------------------------------------------------------------

def _load_done_images(done_path):
    if not os.path.exists(done_path):
        return set()
    with open(done_path, "r", encoding="utf-8") as f:
        return {line.strip() for line in f if line.strip()}


def _mark_done(done_path, basename):
    with open(done_path, "a", encoding="utf-8") as f:
        f.write(basename + "\n")


def label_session(input_dir, output_dir, reset=False):
    lines_dir = os.path.join(output_dir, "lines")
    os.makedirs(lines_dir, exist_ok=True)
    label_path = os.path.join(output_dir, "labels.txt")
    done_path = os.path.join(output_dir, "done_images.txt")

    if reset and os.path.exists(done_path):
        os.remove(done_path)
        print("--reset: cleared done_images.txt. All photos will be shown again "
              "(existing labels.txt entries are kept, not deleted).\n")

    done_images = _load_done_images(done_path)

    existing_count = 0
    if os.path.exists(label_path):
        with open(label_path, "r", encoding="utf-8") as f:
            existing_count = sum(1 for _ in f)
    idx = existing_count

    image_paths = sorted(
        glob.glob(os.path.join(input_dir, "*.jpg"))
        + glob.glob(os.path.join(input_dir, "*.jpeg"))
        + glob.glob(os.path.join(input_dir, "*.png"))
    )

    remaining = [p for p in image_paths if os.path.basename(p) not in done_images]
    skipped_already_done = len(image_paths) - len(remaining)
    print(
        f"Found {len(image_paths)} images "
        f"({skipped_already_done} already done, {len(remaining)} remaining). "
        f"Resuming label numbering from index {idx}.\n"
    )

    with open(label_path, "a", encoding="utf-8") as label_file:
        for img_path in remaining:
            basename = os.path.basename(img_path)
            print(f"\n=== {basename} ===")
            image = cv2.imread(img_path)
            if image is None:
                print("  Could not read image, skipping.")
                _mark_done(done_path, basename)
                continue

            candidates = find_plate_candidates(image)
            if not candidates:
                print("  No plate-like candidates passed the shape/pattern checks. "
                      "Marking as done (the plate may be too small, too angled, or "
                      "too low-contrast in this photo for automatic detection).")
                _mark_done(done_path, basename)
                continue

            preview_path = os.path.join(output_dir, "_preview.jpg")
            candidate_idx = 0
            chosen_crop = None
            cv2.imwrite(preview_path, candidates[candidate_idx])
            print(f"  Saved candidate preview to: {preview_path}")
            print("  Open that file and check: does it show the FULL plate (both lines), deskewed?")

            while True:
                confirm = input(
                    "  Use this candidate? [y]es / [n]ext candidate / [s]kip image: "
                ).strip().lower()
                if confirm == "y":
                    chosen_crop = candidates[candidate_idx]
                    break
                elif confirm == "n":
                    candidate_idx += 1
                    if candidate_idx >= len(candidates):
                        print("  No more candidates for this image.")
                        break
                    cv2.imwrite(preview_path, candidates[candidate_idx])
                    print(f"  Updated preview: {preview_path}")
                elif confirm == "s":
                    break
                else:
                    print("  Please type y, n, or s.")

            if chosen_crop is None:
                print("  Skipped.")
                _mark_done(done_path, basename)
                continue

            lines = split_into_lines(chosen_crop)
            for line_crop in lines:
                line_preview_path = os.path.join(output_dir, "_line_preview.jpg")
                cv2.imwrite(line_preview_path, line_crop)
                print(f"  Line preview: {line_preview_path}")
                text = input(
                    "  Type the EXACT correct text for this line "
                    "(Devanagari — copy-paste is fine, blank to skip this line): "
                ).strip()
                if not text:
                    continue

                out_name = f"{idx:05d}.jpg"
                cv2.imwrite(os.path.join(lines_dir, out_name), line_crop)
                label_file.write(f"lines/{out_name}\t{text}\n")
                label_file.flush()
                print(f"  Saved as lines/{out_name} -> '{text}'")
                idx += 1

            _mark_done(done_path, basename)

    print(f"\nDone. Total labeled lines: {idx}. Label file: {label_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True, help="Folder of raw vehicle photos")
    parser.add_argument("--output-dir", required=True, help="Where to write lines/ and labels.txt")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Clear done-image tracking so every photo is shown again (labels.txt is kept).",
    )
    args = parser.parse_args()
    label_session(args.input_dir, args.output_dir, reset=args.reset)