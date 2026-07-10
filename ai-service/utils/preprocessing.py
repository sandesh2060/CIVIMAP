"""
Shared image preprocessing helpers.

For plate OCR specifically, the goal is to hand PaddleOCR a crop that is:
  - large enough (plates are often <100px tall in the source photo)
  - contrast-normalized (red embossed background + white/silver characters
    varies a lot in real photos: sun glare, shade, flash)
  - deskewed if the plate was photographed at a steep angle
"""

import cv2
import numpy as np


def resize_for_ocr(image: np.ndarray, min_height: int = 128) -> np.ndarray:
    """
    Upscale small plate crops. PaddleOCR (and OCR generally) degrades hard
    on crops shorter than ~100px — this is a major source of the '4 reads
    as 8' type errors, since fine glyph detail (the loop in ४) gets lost.
    """
    h, w = image.shape[:2]
    if h >= min_height:
        return image
    scale = min_height / float(h)
    new_w = int(w * scale)
    return cv2.resize(image, (new_w, min_height), interpolation=cv2.INTER_CUBIC)


def normalize_contrast(image: np.ndarray) -> np.ndarray:
    """
    CLAHE on the L channel (LAB color space) to normalize contrast between
    the red plate background and the embossed/painted characters, without
    blowing out detail the way plain histogram equalization does.
    """
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    merged = cv2.merge((l_channel, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def order_corners(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def perspective_correct(image: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """
    Flatten a plate photographed at an angle using a 4-point homography.
    `corners` should be a (4, 2) array of the plate's four corner points
    in the original image (from the plate detector), in any order.
    """
    rect = order_corners(corners.astype("float32"))
    (tl, tr, br, bl) = rect

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = max(int(width_a), int(width_b))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = max(int(height_a), int(height_b))

    dst = np.array(
        [
            [0, 0],
            [max_width - 1, 0],
            [max_width - 1, max_height - 1],
            [0, max_height - 1],
        ],
        dtype="float32",
    )

    matrix = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, matrix, (max_width, max_height))


def prepare_plate_crop(crop: np.ndarray) -> np.ndarray:
    """
    Full preprocessing pipeline applied to a plate crop right before OCR.
    Call this AFTER perspective_correct (if corner points were available)
    or directly on the axis-aligned bounding-box crop otherwise.
    """
    crop = normalize_contrast(crop)
    crop = resize_for_ocr(crop, min_height=128)
    return crop