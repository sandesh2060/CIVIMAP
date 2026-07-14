#!/usr/bin/env python3
"""generate.py — Phase 1 (Piper edition)

Generates test .wav files for the CIVIMAP navigation voice prompts using
Piper TTS (facebook/mms-tts-npi does not exist — Nepali isn't in the MMS-TTS
collection — so we use Piper's ne_NP-chitwan-medium voice instead).
"""
import os
import wave
from huggingface_hub import hf_hub_download
from piper import PiperVoice

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_output")

# Piper Nepali voice — hosted on rhasspy/piper-voices
VOICE_REPO = "rhasspy/piper-voices"
VOICE_MODEL_PATH = "ne/ne_NP/chitwan/medium/ne_NP-chitwan-medium.onnx"
VOICE_CONFIG_PATH = "ne/ne_NP/chitwan/medium/ne_NP-chitwan-medium.onnx.json"

TEST_PHRASES = {
    "turn_left":        "देब्रे मोड्नुहोस्",
    "turn_right":       "दायाँ मोड्नुहोस्",
    "continue_straight": "सीधा जानुहोस्",
    "uturn":            "यू-टर्न लिनुहोस्",
    "arrived":          "तपाईं आफ्नो गन्तव्यमा पुग्नुभयो",
    "recalculating":    "मार्ग पुनः गणना गर्दै",
}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Downloading/loading ne_NP-chitwan-medium Piper voice (first run downloads ~60MB)...")
    model_path = hf_hub_download(repo_id=VOICE_REPO, filename=VOICE_MODEL_PATH)
    config_path = hf_hub_download(repo_id=VOICE_REPO, filename=VOICE_CONFIG_PATH)

    voice = PiperVoice.load(model_path, config_path=config_path)
    print("Voice loaded. Generating test phrases...\n")

    for name, text in TEST_PHRASES.items():
        out_path = os.path.join(OUT_DIR, f"{name}.wav")
        with wave.open(out_path, "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)
        print(f"  wrote {out_path}   <-  \"{text}\"")

    print(f"\nDone. Open the .wav files in {OUT_DIR} and have a listen.")


if __name__ == "__main__":
    main()