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

WORKFLOW PER IMAGE:
    1. Script finds the best plate-region candidate (reusing the same
       red-mask + edge detection logic as plate_detection.py).
    2. Shows you the crop. You confirm it's the plate (or skip/retry with
       manual coordinates if detection missed).
    3. Script auto-splits the crop into up to 2 lines via horizontal
       projection profile (finds the row with the least text-pixel
       density = the gap between lines).
    4. You type the correct text for each line (copy from the photo,
       don't guess — this IS the ground truth the model will learn from).
    5. Crop + label are saved; label file is appended incrementally so
       you can stop and resume anytime.

REQUIRES: opencv-python, numpy (already in your ai-service venv)
"""

import argparse
import glob
import os

import cv2
import numpy as np

# --- Reuse the same red-mask candidate logic as plate_detection.py ---
# (Duplicated here rather than imported, so this script has zero dependency
# on the FastAPI app / PaddleOCR being installed — it's pure OpenCV.)

MAX_CANDIDATES = 5


def _plate_likeness_score(w, h, img_area):
    if h == 0:
        return 0.0
    aspect = w / h
    area_frac = (w * h) / img_area
    aspect_score = 1.0 - min(abs(aspect - 2.2) / 2.2, 1.0)
    size_score = 1.0 - min(abs(area_frac - 0.05) / 0.30, 1.0)
    return aspect_score * 0.6 + size_score * 0.4


def _merge_nearby_boxes(boxes, max_vertical_gap_ratio=0.8):
    if len(boxes) <= 1:
        return boxes

    def x_overlap_ratio(a, b):
        ax0, _, aw, _ = a
        bx0, _, bw, _ = b
        overlap = max(0, min(ax0 + aw, bx0 + bw) - max(ax0, bx0))
        return overlap / min(aw, bw) if min(aw, bw) > 0 else 0

    def vertical_gap(a, b):
        _, ay0, _, ah = a
        _, by0, _, bh = b
        ay1, by1 = ay0 + ah, by0 + bh
        if ay1 <= by0:
            return by0 - ay1
        if by1 <= ay0:
            return ay0 - by1
        return 0

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
                if x_overlap_ratio(a, b) > 0.4 and vertical_gap(a, b) < max_vertical_gap_ratio * min_h:
                    merged[i] = union(a, b)
                    del merged[j]
                    changed = True
                    break
            if changed:
                break
    return merged


def find_plate_candidates(image):
    h_img, w_img = image.shape[:2]
    img_area = h_img * w_img

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = cv2.bitwise_or(
        cv2.inRange(hsv, np.array([0, 90, 60]), np.array([10, 255, 255])),
        cv2.inRange(hsv, np.array([170, 90, 60]), np.array([180, 255, 255])),
    )
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 15), np.uint8), iterations=2)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    raw_boxes = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w < 40 or h < 15:
            continue
        area_frac = (w * h) / img_area
        if 0.001 < area_frac < 0.5:
            raw_boxes.append((x, y, w, h))

    merged_boxes = _merge_nearby_boxes(raw_boxes)
    scored = sorted(
        merged_boxes,
        key=lambda b: _plate_likeness_score(b[2], b[3], img_area),
        reverse=True,
    )

    candidates = []
    for x, y, w, h in scored[:MAX_CANDIDATES]:
        pad_x, pad_y = int(w * 0.08), int(h * 0.15)
        x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
        x1, y1 = min(w_img, x + w + pad_x), min(h_img, y + h + pad_y)
        candidates.append(image[y0:y1, x0:x1])
    return candidates


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
    if h < 60:  # too short to plausibly contain 2 lines
        return [crop]

    # Search the middle third of the crop for the gap between lines
    search_start, search_end = int(h * 0.3), int(h * 0.7)
    if search_end <= search_start:
        return [crop]

    gap_row = search_start + int(np.argmin(row_density[search_start:search_end]))
    line1 = crop[0:gap_row, :]
    line2 = crop[gap_row:, :]

    # Reject a split that produces a near-empty sliver — not a real 2nd line
    if line1.shape[0] < 20 or line2.shape[0] < 20:
        return [crop]
    return [line1, line2]


def label_session(input_dir, output_dir):
    lines_dir = os.path.join(output_dir, "lines")
    os.makedirs(lines_dir, exist_ok=True)
    label_path = os.path.join(output_dir, "labels.txt")

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
    print(f"Found {len(image_paths)} images. Resuming from label index {idx}.\n")

    with open(label_path, "a", encoding="utf-8") as label_file:
        for img_path in image_paths:
            print(f"\n=== {os.path.basename(img_path)} ===")
            image = cv2.imread(img_path)
            if image is None:
                print("  Could not read image, skipping.")
                continue

            candidates = find_plate_candidates(image)
            if not candidates:
                print("  No plate candidates found. Skipping (consider manual crop later).")
                continue

            # Show the best candidate for confirmation
            best_crop = candidates[0]
            preview_path = os.path.join(output_dir, "_preview.jpg")
            cv2.imwrite(preview_path, best_crop)
            print(f"  Saved candidate preview to: {preview_path}")
            print("  Open that file and check: does it show the FULL plate (both lines)?")

            confirm = input("  Use this candidate? [y]es / [n]ext candidate / [s]kip image: ").strip().lower()
            chosen_crop = None
            if confirm == "y":
                chosen_crop = best_crop
            elif confirm == "n":
                for alt in candidates[1:]:
                    cv2.imwrite(preview_path, alt)
                    print(f"  Updated preview: {preview_path}")
                    alt_confirm = input("  Use this one? [y/n]: ").strip().lower()
                    if alt_confirm == "y":
                        chosen_crop = alt
                        break
            if chosen_crop is None:
                print("  Skipped.")
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

    print(f"\nDone. Total labeled lines: {idx}. Label file: {label_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True, help="Folder of raw vehicle photos")
    parser.add_argument("--output-dir", required=True, help="Where to write lines/ and labels.txt")
    args = parser.parse_args()
    label_session(args.input_dir, args.output_dir)