# file: ai-service/routes/tts.py
"""
GET /tts — server-side speech synthesis.

Replaces the browser's SpeechSynthesis API (whose quality depends entirely
on whatever voices happen to be installed on the user's device) with two
purpose-picked open-source neural models running here:

  - English ("en"): Kokoro-82M (Apache-2.0) — near-human quality, 24kHz.
    Served via the `pykokoro` package rather than the official `kokoro`
    package: `kokoro` hard-caps at Python <3.13 and this project runs on
    3.13. `pykokoro` is an independently maintained ONNX-runtime wrapper
    around the same Kokoro-82M weights — same model, same voice, just a
    different (and newer-Python-compatible) inference implementation.
  - Nepali  ("ne"): Piper (ne_NP-chitwan-medium) — the best free Nepali
    voice that currently exists. Nepali is a low-resource language for
    speech synthesis — no free/paid-tier option from Google, Azure, or
    Amazon generates Nepali speech at all, so this is the ceiling, not
    a corner we're cutting. It's clear and correctly pronounced, not
    studio-human.

Both models are lazy-loaded on first request (not at import time) so
app.py startup doesn't pay the model-load cost, and a broken Kokoro/
Piper install only breaks /tts, not the whole service.

Exposed as GET (not POST) with text/lang as query params on purpose:
lets <audio src="..."> be set directly on the client with no fetch/blob
plumbing, and lets the browser's normal HTTP cache dedupe repeated nav
phrases ("Turn left" gets requested constantly) for free.

Requires piper-tts>=1.4 (the piper1-gpl rewrite, PyPI project
"piper-tts", import name "piper") for the SynthesisConfig-based API used
in _synthesize_nepali below. Confirmed against piper-tts==1.4.2:
  PiperVoice.synthesize_wav(text, wav_file, syn_config: SynthesisConfig | None = None, ...)
  SynthesisConfig(speaker_id=None, length_scale=None, noise_scale=None,
                   noise_w_scale=None, normalize_audio=True, volume=1.0)
"""
import io
import logging
import wave
from functools import lru_cache

import numpy as np
import soundfile as sf
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from piper import PiperVoice, SynthesisConfig

logger = logging.getLogger(__name__)
router = APIRouter(tags=["tts"])

MAX_TEXT_LENGTH = 500

# Piper's length_scale stretches phoneme duration *inside* the model at
# synthesis time (1.0 = the model's natural default pace). This replaced
# a client-side <audio>.playbackRate = 0.92 slowdown, which was stretching
# the already-rendered waveform after the fact — audible as a faint
# warble/graininess on top of Piper's output. Nudging length_scale here
# instead keeps the pacing change inside the model's own synthesis, which
# reads more cleanly. Slightly above 1.0 = slightly slower/clearer.
# Tune in ~0.05 steps if it still isn't clear enough — 1.0 is the
# model's own natural pace, so that's the floor to try first.
NEPALI_LENGTH_SCALE = 1.08

# ---------------------------------------------------------------------------
# Lazy singletons — loaded once, reused across requests
# ---------------------------------------------------------------------------

_kokoro_pipeline = None
_piper_voice: PiperVoice | None = None


def _get_kokoro():
    global _kokoro_pipeline
    if _kokoro_pipeline is None:
        from pykokoro import KokoroPipeline, PipelineConfig
        logger.info("Loading Kokoro (English TTS)...")
        _kokoro_pipeline = KokoroPipeline(PipelineConfig(voice="af_heart"))
        logger.info("Kokoro loaded.")
    return _kokoro_pipeline


def _get_piper() -> PiperVoice:
    global _piper_voice
    if _piper_voice is None:
        from huggingface_hub import hf_hub_download

        logger.info("Loading Piper ne_NP-chitwan-medium (Nepali TTS)...")
        model_path = hf_hub_download(
            repo_id="rhasspy/piper-voices",
            filename="ne/ne_NP/chitwan/medium/ne_NP-chitwan-medium.onnx",
        )
        config_path = hf_hub_download(
            repo_id="rhasspy/piper-voices",
            filename="ne/ne_NP/chitwan/medium/ne_NP-chitwan-medium.onnx.json",
        )
        _piper_voice = PiperVoice.load(model_path, config_path=config_path)
        logger.info("Piper loaded.")
    return _piper_voice


# ---------------------------------------------------------------------------
# Synthesis — each returns (audio_samples, sample_rate); the two engines
# use different native rates (Kokoro 24kHz, Piper ~22.05kHz), so the rate
# travels with the audio rather than being assumed.
# ---------------------------------------------------------------------------

def _synthesize_english(text: str):
    pipeline = _get_kokoro()
    result = pipeline.run(text)
    if result.audio is None or len(result.audio) == 0:
        raise HTTPException(status_code=500, detail="Kokoro produced no audio")
    return result.audio, 24000


def _synthesize_nepali(text: str):
    voice = _get_piper()
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        voice.synthesize_wav(
            text,
            wav_file,
            syn_config=SynthesisConfig(length_scale=NEPALI_LENGTH_SCALE),
        )
    buffer.seek(0)
    data, rate = sf.read(buffer, dtype="float32")
    return data, rate


# Repeated nav phrases ("Turn left", common street names) are extremely
# common in this app — cache synthesized audio in-process so the same
# text+lang pair is only ever synthesized once per server lifetime.
@lru_cache(maxsize=256)
def _synthesize_cached(text: str, lang: str) -> bytes:
    audio, rate = _synthesize_english(text) if lang == "en" else _synthesize_nepali(text)
    out = io.BytesIO()
    sf.write(out, audio, rate, format="WAV")
    return out.getvalue()


@router.get("/tts")
def synthesize(
    text: str = Query(..., min_length=1, max_length=MAX_TEXT_LENGTH),
    lang: str = Query("en", pattern="^(en|ne)$"),
):
    try:
        wav_bytes = _synthesize_cached(text.strip(), lang)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("TTS synthesis failed")
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {exc}") from exc

    # Plain Response (not StreamingResponse) with explicit Content-Length
    # and Accept-Ranges — Safari's <audio> element refuses to play a
    # source that doesn't advertise range support, even though the exact
    # same bytes download fine via curl or a direct navigation. Chrome/
    # Firefox don't enforce this, which is why this only broke in Safari.
    # The whole clip is already synthesized in memory at this point, so
    # there's no streaming benefit being given up here.
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Cache-Control": "public, max-age=86400",  # 24h browser cache
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(wav_bytes)),
        },
    )