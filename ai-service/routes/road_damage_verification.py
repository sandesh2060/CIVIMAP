"""
Road damage verification endpoint.

IMPORTANT: This ships with a heuristic placeholder, NOT a trained model.
It genuinely works end-to-end (downloads the image, analyzes it, returns a
real confidence score) so you can test the full pipeline today. Swap
`classify_image()` for a real trained CNN (see TODO below) when ready —
the request/response contract stays identical, so nothing else changes.
"""

import io

import cv2
import numpy as np
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

MIN_RESOLUTION = 200  # px, shortest side
BLUR_VARIANCE_THRESHOLD = 80  # Laplacian variance below this = too blurry to trust


class VerifyRequest(BaseModel):
    imageUrl: str


class VerifyResponse(BaseModel):
    label: str
    confidence: float
    flagForReview: bool


def download_image(url: str) -> np.ndarray:
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=422, detail=f"Could not download image: {e}")

    arr = np.frombuffer(resp.content, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=422, detail="File is not a valid image")
    return img


def classify_image(img: np.ndarray) -> tuple[str, float]:
    """
    Heuristic placeholder pipeline:
      1. Reject too-small or corrupt images outright.
      2. Reject blurry images (low Laplacian variance) - can't verify damage
         in a blurry photo, so treat as low confidence rather than guessing.
      3. Reject near-blank/uniform images (low pixel variance) - usually a
         spam/irrelevant upload, not a real road photo.
      4. Otherwise, use edge density as a rough proxy for "textured road
         surface with visible damage" - genuinely correlates with real
         pothole/crack photos vs. e.g. a photo of the sky or a wall.

    TODO: replace this function with inference from a trained model
    (e.g. a MobileNet/ResNet fine-tuned on a road-damage dataset such as
    RDD2022). Keep the same return signature: (label: str, confidence: float)
    """
    h, w = img.shape[:2]
    if min(h, w) < MIN_RESOLUTION:
        return "irrelevant", 0.15

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if laplacian_var < BLUR_VARIANCE_THRESHOLD:
        return "too_blurry", 0.30

    pixel_std = float(np.std(gray))
    if pixel_std < 15:
        return "irrelevant", 0.20

    edges = cv2.Canny(gray, 100, 200)
    edge_density = float(np.count_nonzero(edges)) / edges.size

    # Rough heuristic mapping: more visible texture/edges -> higher confidence
    # this is a genuine road-surface photo with damage. Calibrate these
    # cutoffs against real sample photos once you have some.
    if edge_density > 0.08:
        return "pothole", min(0.55 + edge_density * 3, 0.97)
    elif edge_density > 0.03:
        return "crack", 0.60
    else:
        return "irrelevant", 0.35


@router.post("/road-damage-verification", response_model=VerifyResponse)
def verify_road_damage(payload: VerifyRequest):
    img = download_image(payload.imageUrl)
    label, confidence = classify_image(img)

    return VerifyResponse(
        label=label,
        confidence=round(confidence, 3),
        flagForReview=confidence < 0.75,
    )