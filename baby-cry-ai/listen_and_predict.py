#!/usr/bin/env python3
"""
Listen to the microphone, record a short clip, and run the baby cry classifier.
Uses VAD (RMS energy) and confidence threshold: silence and low-confidence
predictions return "no_cry". Requires: pip install sounddevice

Usage:
    python listen_and_predict.py          # record once, print result
    python listen_and_predict.py --loop   # keep recording until Ctrl+C
"""

import argparse
import os
import pickle
import sys
import time
from pathlib import Path

# Reduce TensorFlow log noise before importing tf
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
from tensorflow import keras

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.audio_preprocessing import SR, DURATION_SEC
from utils.prediction import predict_cry_with_vad

try:
    import sounddevice as sd
except ImportError:
    print("Install sounddevice: pip install sounddevice", file=sys.stderr)
    sys.exit(1)

MODEL_PATH = PROJECT_ROOT / "model" / "baby_cry_cnn_model.h5"
LABEL_ENCODER_PATH = PROJECT_ROOT / "model" / "label_encoder.pkl"


def load_model_and_encoder():
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    if not LABEL_ENCODER_PATH.is_file():
        raise FileNotFoundError(f"Label encoder not found: {LABEL_ENCODER_PATH}")
    model = keras.models.load_model(MODEL_PATH)
    with open(LABEL_ENCODER_PATH, "rb") as f:
        label_encoder = pickle.load(f)
    return model, label_encoder


def record_audio(duration_sec: float = DURATION_SEC, sample_rate: int = SR):
    """Record from default microphone. Returns (samples, sample_rate)."""
    num_samples = int(duration_sec * sample_rate)
    print(f"Recording for {duration_sec} s at {sample_rate} Hz... (speak or play baby cry)", flush=True)
    recording = sd.rec(
        num_samples,
        samplerate=sample_rate,
        channels=1,
        dtype=np.float32,
    )
    sd.wait()
    return recording.flatten(), sample_rate


def main():
    parser = argparse.ArgumentParser(description="Listen to mic and classify baby cry")
    parser.add_argument("--loop", action="store_true", help="Keep recording until Ctrl+C")
    parser.add_argument("--duration", type=float, default=DURATION_SEC, help=f"Recording length in seconds (default {DURATION_SEC})")
    args = parser.parse_args()

    try:
        model, label_encoder = load_model_and_encoder()
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print("Baby Cry classifier — microphone mode")
    print("Model loaded. Use default microphone.", flush=True)

    try:
        while True:
            print()
            if not args.loop:
                input("Press Enter to start recording... ")
            y, sr = record_audio(duration_sec=args.duration)
            result, reason = predict_cry_with_vad(y, sr, model, label_encoder)
            print(reason)
            print(f"  → cry_type: {result['cry_type']}, confidence: {result['confidence']:.2f}")
            if not args.loop:
                break
            print("  Next recording in 3 s... (Ctrl+C to stop)")
            time.sleep(3)
        print("Done.")
    except KeyboardInterrupt:
        print("\nStopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
