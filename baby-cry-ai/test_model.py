#!/usr/bin/env python3
"""
Local test script for the baby cry classification CNN model.
Loads the trained model and label encoder, runs the same preprocessing
as training, and returns prediction + confidence for a given audio file.

Usage:
    python test_model.py test_audio.wav
    python test_model.py path/to/sample.wav
    python test_model.py sample.wav   # uses first .wav from datasets/ if file missing

Output format:
    {"cry_type": "hungry", "confidence": 0.82}
"""

import json
import os
import pickle
import sys
from pathlib import Path

# Reduce TensorFlow log noise (set before importing tf)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
from tensorflow import keras

# Project root for imports and model paths
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import librosa

from utils.audio_preprocessing import SR
from utils.prediction import predict_cry_with_vad

MODEL_PATH = PROJECT_ROOT / "model" / "baby_cry_cnn_model.h5"
LABEL_ENCODER_PATH = PROJECT_ROOT / "model" / "label_encoder.pkl"


def load_model_and_encoder():
    """Load the trained CNN model and label encoder from disk."""
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    if not LABEL_ENCODER_PATH.is_file():
        raise FileNotFoundError(f"Label encoder not found: {LABEL_ENCODER_PATH}")
    model = keras.models.load_model(MODEL_PATH)
    with open(LABEL_ENCODER_PATH, "rb") as f:
        label_encoder = pickle.load(f)
    return model, label_encoder


def predict(audio_path: str, model=None, label_encoder=None):
    """
    Run inference with VAD and confidence threshold.
    Returns dict: {"cry_type": str, "confidence": float}
    and logs reason (Silence detected / Low confidence prediction / Cry detected).
    """
    if model is None or label_encoder is None:
        model, label_encoder = load_model_and_encoder()
    try:
        y, sr = librosa.load(audio_path, sr=SR, mono=True)
    except Exception:
        return {"cry_type": None, "confidence": 0.0, "error": "Invalid or unreadable audio"}
    result, reason = predict_cry_with_vad(y, sr, model, label_encoder)
    print(reason, file=sys.stderr)
    return result


def main():
    if len(sys.argv) != 2:
        print("Usage: python test_model.py <audio_file.wav>", file=sys.stderr)
        sys.exit(1)

    audio_path = Path(sys.argv[1])
    if not audio_path.is_file():
        # If user passed "sample.wav", try first .wav from datasets
        if audio_path.name == "sample.wav":
            datasets_dir = PROJECT_ROOT / "datasets"
            first_wav = next((p for p in datasets_dir.rglob("*.wav")), None)
            if first_wav is not None:
                audio_path = first_wav
                print(f"Using dataset sample: {audio_path}", file=sys.stderr)
            else:
                print("Error: No sample.wav and no .wav files found in datasets/", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"Error: File not found: {audio_path}", file=sys.stderr)
            print("Use a path to an existing .wav file, e.g. from datasets:", file=sys.stderr)
            print("  python test_model.py 'datasets/Infant Cry Corpus/hungry/<some>.wav'", file=sys.stderr)
            sys.exit(1)

    try:
        model, label_encoder = load_model_and_encoder()
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    result = predict(str(audio_path), model=model, label_encoder=label_encoder)
    if result.get("error"):
        print(f"Error: {result['error']}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
