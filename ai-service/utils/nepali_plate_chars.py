"""
Nepali vehicle plate character rules.

This module exists to fix two specific, recurring OCR failure modes on
Nepali plates:

1. Devanagari ४ (4) being misread as Latin "8" under glare/embossing.
2. Extra spurious characters (screw holes, glare blobs, line-bleed between
   the two plate rows) being appended to the recognized string.

The approach: restrict the valid output alphabet to ONLY the characters
that can legally appear on a Nepali plate, correct known look-alike
confusions, then validate the final string against known plate formats
and trim anything that doesn't fit.
"""

import re

# ---------------------------------------------------------------------------
# 1. Valid character set
# ---------------------------------------------------------------------------

# Devanagari digits 0-9
DEVANAGARI_DIGITS = "०१२३४५६७८९"

# Devanagari consonants that actually appear on Nepali plates
# (province code letters + vehicle category letters: क ख ग च ज झ प ब भ म य etc.)
PLATE_LETTERS = "कखगचजझटठडढणतथदधनपफबभमयरलवशषसह"

# Devanagari vowel signs/diacritics (matras) that legitimately appear in
# province-code prefixes, e.g. "बा" = ब + ा.
_PLATE_MATRAS = "ािीुूेैोौंँ्"

# Everything the OCR is allowed to output. Anything outside this set
# (Latin digits, Latin letters, punctuation, symbols) is invalid by
# construction and should never survive post-processing.
#
# BUGFIX: this previously omitted matras entirely, so strip_invalid_chars()
# silently deleted the vowel sign from any correctly-read prefix like
# "बा" (ब + ा), turning it into "ब" -- deterministic data loss on every
# plate whose province code uses a matra, independent of OCR confidence.
VALID_PLATE_CHARSET = set(DEVANAGARI_DIGITS + PLATE_LETTERS + _PLATE_MATRAS + " .-")


# ---------------------------------------------------------------------------
# 2. Known look-alike confusions (glyph shape, NOT phonetic)
# ---------------------------------------------------------------------------
# Map: character the model tends to output incorrectly -> correct Devanagari
# character it usually should have been. Keys can be Latin (cross-script
# confusion) or Devanagari (within-script confusion).
CONFUSION_MAP = {
    # Cross-script: Latin digit that a Devanagari glyph gets misread as
    "8": "४",   # ४ (4) has a closed loop that reads as top of "8" under glare
    "3": "३",   # sometimes read straight through as Latin 3
    "9": "९",
    "0": "०",
    "2": "२",
    "1": "१",
    "5": "५",
    "6": "६",
    "7": "७",
    "4": "४",
}

# Pairs of Devanagari digits that are visually similar enough to be
# genuinely confused by OCR even WITHIN pure-Devanagari output (not just
# Latin-lookalike confusion). A static 1:1 map can't safely resolve these,
# since both members of a pair are legitimate digits elsewhere on the same
# plate (e.g. "बा.८४" uses both ४ and ८) — the correct approach, done in
# generate_digit_swap_variants() below, is to try both readings and keep
# whichever actually satisfies format validation, rather than always
# substituting one for the other regardless of context.
AMBIGUOUS_DIGIT_PAIRS = [
    ("४", "८"),
    ("३", "५"),
    ("०", "६"),
]


def generate_digit_swap_variants(tail_digits: str) -> list:
    """
    Given a candidate digit tail, generates variants by swapping each
    character that's part of a known ambiguous pair, one position at a
    time (not all combinations at once — real OCR mistakes are rarely
    more than one character wrong on a short tail, and combinatorial
    swaps would explode false-positive matches against loose validation).
    Returns [original, variant1, variant2, ...] with the original first.
    """
    if not tail_digits:
        return [tail_digits]
    variants = [tail_digits]
    for i, ch in enumerate(tail_digits):
        for a, b in AMBIGUOUS_DIGIT_PAIRS:
            swap = b if ch == a else (a if ch == b else None)
            if swap:
                variant = tail_digits[:i] + swap + tail_digits[i + 1:]
                if variant not in variants:
                    variants.append(variant)
    return variants


# Devanagari vowel signs/diacritics (matras) — needed alongside consonants
# and digits to correctly judge whether a string is "already Devanagari"
# before attempting confusion-correction on it.
DEVANAGARI_MATRAS = "ािीुूेैोौंँ्"


def _devanagari_ratio(text: str) -> float:
    """
    Fraction of non-space characters that are ALREADY valid Devanagari
    plate characters, computed BEFORE any confusion correction runs.

    Why this exists: normalize_confusable_chars() used to run on any raw
    OCR string unconditionally. A garbage read like 'EY8T' would pass
    through mostly untouched (E, Y, T aren't in CONFUSION_MAP) except for
    '8' -> '४' — and strip_invalid_chars() would then delete the leftover
    Latin letters, leaving a single '४' that looks like a confident,
    valid plate digit. That's worse than an obvious failure: a garbage
    read and a real ४ become indistinguishable downstream, and
    flagForReview never fires on it. Gating correction on "is this
    string already mostly Devanagari" stops that laundering.
    """
    chars = [c for c in text if c != " "]
    if not chars:
        return 0.0
    devanagari_chars = set(DEVANAGARI_DIGITS + PLATE_LETTERS + DEVANAGARI_MATRAS)
    hits = sum(1 for c in chars if c in devanagari_chars)
    return hits / len(chars)


def normalize_confusable_chars(text: str) -> str:
    """
    Pass 1: replace any character the model is known to confuse with its
    correct Devanagari counterpart — but ONLY when the surrounding text is
    already mostly Devanagari (see _devanagari_ratio). If the text is
    mostly Latin/garbage, correcting individual characters would just
    produce a confident-looking wrong answer instead of surfacing the
    failure; downstream strip_invalid_chars() + format validation should
    be left to correctly reject it as garbage instead.
    """
    if _devanagari_ratio(text) < 0.5:
        return text
    return "".join(CONFUSION_MAP.get(ch, ch) for ch in text)


def strip_invalid_chars(text: str) -> str:
    """
    Pass 2: hard filter — drop any character not in VALID_PLATE_CHARSET.
    This is what removes junk picked up from screw holes / glare / noise
    that pass 1 didn't already fix, since nothing outside the plate
    alphabet can survive.
    """
    return "".join(ch for ch in text if ch in VALID_PLATE_CHARSET)


# ---------------------------------------------------------------------------
# 3. Known Nepali plate formats
# ---------------------------------------------------------------------------
# Nepali plates commonly render as two logical groups:
#   <province/prefix> <category letter> <digit group>
# e.g. "बा १५ च ५४८७", "बागमती प्रदेश-०१  ०१ १च ४३१४", "प्रदेश ३ ०२  प १० ८३२०"
# Exact province text varies a lot by plate era/style, so we validate the
# NUMERIC tail strictly (this is what actually matters for identification)
# rather than trying to hard-code every province string variant.

# The trailing digit group is almost always 3-4 Devanagari digits.
TAIL_DIGITS_RE = re.compile(r"[" + DEVANAGARI_DIGITS + r"]{3,4}$")

# A single Devanagari category letter often appears just before the digits.
CATEGORY_LETTER_RE = re.compile(r"[" + PLATE_LETTERS + r"]")


def vote_on_tail_digits(readings: list) -> "tuple[str, bool] | tuple[None, bool]":
    """
    Takes multiple (tail_digits, confidence) readings — one per candidate
    crop already OCR'd by plate_detection.py — and returns a consensus
    reading via per-character, confidence-weighted majority voting.

    This implements the "multi-pass + majority voting" idea (your doc's
    Stage 16) using OCR passes that already happen (one per candidate
    region), rather than requiring additional OCR calls. Positions where
    voting is close are resolved using AMBIGUOUS_DIGIT_PAIRS: if the top
    two candidates at a position are a known ambiguous pair, the higher-
    confidence-weighted one wins rather than treating it as a tie.

    Only readings sharing the majority length are considered — a 3-digit
    and a 4-digit reading of the same plate aren't the same measurement,
    so mixing them into one vote would corrupt the result.

    Returns (consensus_tail_digits, was_corrected) or (None, False) if
    there's nothing to vote on.
    """
    valid = [(text, conf) for text, conf in readings if text]
    if not valid:
        return None, False
    if len(valid) == 1:
        return valid[0][0], False

    from collections import Counter

    length_weights = Counter()
    for text, conf in valid:
        length_weights[len(text)] += conf
    majority_length = max(length_weights, key=length_weights.get)

    same_length = [(t, c) for t, c in valid if len(t) == majority_length]
    if len(same_length) == 1:
        return same_length[0][0], False

    consensus_chars = []
    for pos in range(majority_length):
        votes = Counter()
        for text, conf in same_length:
            votes[text[pos]] += conf
        winner = max(votes, key=votes.get)
        consensus_chars.append(winner)

    consensus = "".join(consensus_chars)
    was_corrected = consensus not in {t for t, _ in same_length}
    return consensus, was_corrected


def extract_plate_number(raw_text: str) -> dict:
    """
    Takes raw OCR output (already confusion-corrected + charset-filtered)
    and returns a structured, trimmed result.

    Returns:
        {
            "full_text": str,       # cleaned full string
            "tail_digits": str|None,# the numeric identifier, most reliable part
            "is_valid_format": bool,
            "trimmed": bool         # True if extra chars had to be removed
        }
    """
    original = raw_text
    text = normalize_confusable_chars(raw_text)
    text = strip_invalid_chars(text)
    text = re.sub(r"\s+", " ", text).strip()

    tail_match = TAIL_DIGITS_RE.search(text.replace(" ", ""))
    tail_digits = tail_match.group(0) if tail_match else None

    # If the digit tail is longer than 4 (a classic "extra number appended"
    # symptom), keep only the last 4 — the trailing group is the actual
    # plate identifier; leading extra digits are almost always noise
    # bleeding in from the province/category line above it.
    trimmed = False
    if tail_digits and len(tail_digits) > 4:
        tail_digits = tail_digits[-4:]
        trimmed = True

    is_valid = tail_digits is not None and 3 <= len(tail_digits) <= 4

    return {
        "full_text": text,
        "tail_digits": tail_digits,
        "is_valid_format": is_valid,
        "trimmed": trimmed or (text != original),
    }