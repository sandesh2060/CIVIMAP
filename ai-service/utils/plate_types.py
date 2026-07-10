"""
Per-plate-type configuration: detection color (HSV ranges), valid OCR
charset, and whether the type is bilingual.

IMPORTANT — data provenance: web sources disagree with each other on
Nepal's plate color-coding by type (private has been reported as both
red/white and white/black across different sources; diplomatic as both
blue/white and white/blue-text; commercial as both black and yellow), and
colors have also changed across plate eras (hand-written pre-2017 vs.
bilingual embossed 2020+, plus an October-2025 rule change that moved
honorary-consul vehicles off diplomatic plates). Web research alone is
NOT a reliable source for the HSV ranges below.

PRIVATE and DIPLOMATIC are seeded from real sample photos (7 private,
2 diplomatic) and are safe to rely on. GOVERNMENT, TOURIST, and
COMMERCIAL are UNVERIFIED STUBS: hsv_ranges is None, which makes the
color-mask detector skip them entirely (edge-based detection still runs
for every photo as a fallback regardless of type) until real sample
photos are collected and these are calibrated the same way PRIVATE and
DIPLOMATIC were.

Also worth remembering: DIPLOMATIC turned out to be bilingual (Devanagari
+ a Latin duplicate line) when the earlier Devanagari-only assumption said
it shouldn't be. Don't assume GOVERNMENT/TOURIST/COMMERCIAL are
Devanagari-only either without checking real photos first — the stub
charsets below are a starting guess, not a settled answer.
"""

from dataclasses import dataclass
from typing import Optional, Sequence, Tuple

import numpy as np

from utils.nepali_plate_chars import LATIN_PLATE_CHARSET, VALID_PLATE_CHARSET


@dataclass(frozen=True)
class PlateType:
    name: str
    # List of (lower_hsv, upper_hsv) uint8 arrays. None = not yet
    # calibrated; _generate_candidates skips color-mask detection for
    # this type entirely rather than guessing at a range.
    hsv_ranges: Optional[Sequence[Tuple[np.ndarray, np.ndarray]]]
    # Characters this type's OCR output is allowed to contain — gates
    # whether a per-line re-read is trusted (see
    # plate_detection._is_valid_plate_text).
    valid_charset: set
    # True if this type legitimately renders the same number in two
    # scripts on two separate lines (currently only DIPLOMATIC).
    # Enables cross-script digit validation instead of single-line
    # format validation.
    bilingual: bool = False
    # False = no real sample photos yet for this type; hsv_ranges /
    # valid_charset here are a best-effort starting guess, not confirmed.
    verified: bool = True


# Red wraps around hue 0/180 in HSV -> two ranges. Confirmed against 7
# real private-plate photos (red background, white/silver Devanagari
# text, two lines: province/category line + digit line).
PRIVATE = PlateType(
    name="private",
    hsv_ranges=[
        (np.array([0, 80, 60], dtype=np.uint8), np.array([10, 255, 255], dtype=np.uint8)),
        (np.array([170, 80, 60], dtype=np.uint8), np.array([180, 255, 255], dtype=np.uint8)),
    ],
    valid_charset=VALID_PLATE_CHARSET,
    bilingual=False,
    verified=True,
)

# Confirmed against 2 real diplomatic-plate photos (blue background,
# white text, bilingual: Devanagari line above a Latin duplicate of the
# same number, e.g. '६१-सि.डी.-१४०' / '61-C D-140'). Range below is a
# first pass from just those 2 samples -- narrower than PRIVATE's because
# there's less data to average over. Widen once more diplomatic photos
# come in and the true saturation/value spread across lighting conditions
# is visible.
DIPLOMATIC = PlateType(
    name="diplomatic",
    hsv_ranges=[
        (np.array([100, 60, 40], dtype=np.uint8), np.array([130, 255, 255], dtype=np.uint8)),
    ],
    valid_charset=VALID_PLATE_CHARSET | LATIN_PLATE_CHARSET,
    bilingual=True,
    verified=True,
)

# --- UNVERIFIED STUBS -------------------------------------------------
# hsv_ranges=None -> _generate_candidates skips color-mask detection for
# these; edge-based detection is still attempted for every photo as a
# fallback. Once you have a handful of real sample photos per type,
# calibrate hsv_ranges the same way PRIVATE/DIPLOMATIC were (sample the
# actual background hue/sat/value from crops, don't guess from web
# descriptions), and flip verified=True.

GOVERNMENT = PlateType(
    name="government",
    hsv_ranges=None,
    valid_charset=VALID_PLATE_CHARSET,  # unconfirmed guess
    bilingual=False,  # unconfirmed guess
    verified=False,
)

TOURIST = PlateType(
    name="tourist",
    hsv_ranges=None,
    valid_charset=VALID_PLATE_CHARSET,  # unconfirmed guess
    bilingual=False,  # unconfirmed guess
    verified=False,
)

COMMERCIAL = PlateType(
    name="commercial",
    hsv_ranges=None,
    valid_charset=VALID_PLATE_CHARSET,  # unconfirmed guess
    bilingual=False,  # unconfirmed guess
    verified=False,
)

ALL_PLATE_TYPES = [PRIVATE, DIPLOMATIC, GOVERNMENT, TOURIST, COMMERCIAL]

# Only types with calibrated color ranges participate in color-mask
# candidate generation right now (PRIVATE, DIPLOMATIC). Add types here as
# their hsv_ranges get calibrated from real photos.
COLOR_DETECTABLE_TYPES = [t for t in ALL_PLATE_TYPES if t.hsv_ranges]

# Permissive gate used when a candidate has no color-based type guess
# (edge-detected only). Allows either private or diplomatic content
# through the per-line re-read trust gate; the actual type is decided
# afterward based on what was actually read (see
# plate_detection.plate_detection()'s effective_type logic).
UNION_CHARSET = PRIVATE.valid_charset | DIPLOMATIC.valid_charset