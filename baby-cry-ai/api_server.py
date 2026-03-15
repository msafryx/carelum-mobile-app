#!/usr/bin/env python3
"""
Baby Cry AI — FastAPI inference service.

Loads the trained CNN model and label encoder on startup.
Exposes POST /predict for audio upload and GET / for health check.

Run the server:
    uvicorn api_server:app --host 0.0.0.0 --port 8002
    # or with auto-reload during development:
    uvicorn api_server:app --reload

Test in browser:
    http://localhost:8002/docs

Test with curl:
    curl -X POST -F "file=@test_audio.wav" http://localhost:8002/predict

Mobile app flow:
    1. App records baby cry audio (e.g. .wav).
    2. POST audio to /predict (multipart/form-data, field name: file).
    3. API returns JSON: {"cry_type": "hungry", "confidence": 0.78}.
    4. App displays cry_type and confidence to the user.
"""

import pickle
import tempfile
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from tensorflow import keras

# Project root
PROJECT_ROOT = Path(__file__).resolve().parent
import sys
sys.path.insert(0, str(PROJECT_ROOT))

import librosa

from utils.audio_preprocessing import SR
from utils.prediction import predict_cry_with_vad

# ---------------------------------------------------------------------------
# PATHS
# ---------------------------------------------------------------------------
MODEL_PATH = PROJECT_ROOT / "model" / "baby_cry_cnn_model.h5"
LABEL_ENCODER_PATH = PROJECT_ROOT / "model" / "label_encoder.pkl"

# ---------------------------------------------------------------------------
# APP & GLOBAL MODEL (loaded on startup)
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Baby Cry AI API",
    description="Upload baby cry audio and get predicted cry type and confidence.",
    version="1.0",
)

_model = None
_label_encoder = None


def get_model():
    """Lazy load model and encoder (loaded once on first request if not at startup)."""
    global _model, _label_encoder
    if _model is None or _label_encoder is None:
        if not MODEL_PATH.is_file():
            raise FileNotFoundError("Model file not found. Train the model first.")
        if not LABEL_ENCODER_PATH.is_file():
            raise FileNotFoundError("Label encoder not found. Train the model first.")
        _model = keras.models.load_model(MODEL_PATH)
        with open(LABEL_ENCODER_PATH, "rb") as f:
            _label_encoder = pickle.load(f)
    return _model, _label_encoder


@app.on_event("startup")
def load_model_on_startup():
    """Load model and label encoder when the server starts."""
    try:
        get_model()
        print("Model and label encoder loaded successfully.")
    except FileNotFoundError as e:
        print(f"Warning: Could not load model on startup: {e}. Will attempt on first /predict.")


# ---------------------------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    """Health check endpoint. Returns status message."""
    return {"status": "Baby Cry AI API running"}


# ---------------------------------------------------------------------------
# PREDICTION ENDPOINT
# ---------------------------------------------------------------------------
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Accept a .wav audio file (multipart/form-data, field name: file).
    Run preprocessing -> Mel spectrogram -> CNN -> return cry_type and confidence.

    Returns:
        {"cry_type": str, "confidence": float}
    or structured error JSON on failure.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".wav"):
        return JSONResponse(
            status_code=400,
            content={
                "error": "invalid_audio",
                "message": "Only .wav files are accepted.",
                "detail": "Use multipart/form-data with field name 'file' and a .wav file.",
            },
        )

    temp_path = None
    try:
        # Save uploaded file temporarily
        contents = await file.read()
        if not contents:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "invalid_audio",
                    "message": "Uploaded file is empty.",
                },
            )
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(contents)
            temp_path = tmp.name

        # Load model and encoder
        model, label_encoder = get_model()

        # Load audio for VAD + prediction
        try:
            y, sr = librosa.load(temp_path, sr=SR, mono=True)
        except Exception:
            return JSONResponse(
                status_code=422,
                content={
                    "error": "feature_extraction_failure",
                    "message": "Could not load or process audio. File may be corrupted or not a valid WAV.",
                },
            )

        result, reason = predict_cry_with_vad(y, sr, model, label_encoder)
        print(reason)
        return {"cry_type": result["cry_type"], "confidence": result["confidence"]}

    except FileNotFoundError as e:
        return JSONResponse(
            status_code=503,
            content={
                "error": "model_unavailable",
                "message": "Model or label encoder not found. Server may still be starting.",
                "detail": str(e),
            },
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "error": "prediction_error",
                "message": "Model prediction failed.",
                "detail": str(e),
            },
        )
    finally:
        # Clean up temp file
        if temp_path and Path(temp_path).is_file():
            try:
                Path(temp_path).unlink()
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
