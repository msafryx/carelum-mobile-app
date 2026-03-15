#!/usr/bin/env python3
"""
Carelum Baby Cry Inference API — production-ready, contract-compliant.

Matches the Carelum mobile app contract:
  POST /predict (multipart/form-data, field: file) → JSON with cry_type, confidence_score, reason_suggested.
  GET /health → {"status": "ok"}

Start server (port 8001 = same as Carelum app .env so no change needed):
  cd baby-cry-ai && ./venv/bin/uvicorn carelum_cry_api:app --host 0.0.0.0 --port 8001

Test with curl:
  curl -X POST http://localhost:8001/predict -F "file=@recording.wav"
  curl http://localhost:8001/health

Mobile app: EXPO_PUBLIC_AI_SERVICE_URL=http://YOUR_IP:8001 (already set in frontend .env)
"""

import logging
import pickle
import sys
import tempfile
from pathlib import Path

import numpy as np
import librosa
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import tensorflow as tf

# Project root
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.audio_preprocessing import (
    load_and_preprocess,
    SR,
    DURATION_SEC,
    preprocess_audio_array,
)
from utils.feature_extraction import (
    audio_path_to_mel_spectrogram,
    mel_spectrogram_to_cnn_input,
    extract_mel_spectrogram,
)

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
MODEL_PATH = PROJECT_ROOT / "model" / "baby_cry_cnn_model.h5"
LABEL_ENCODER_PATH = PROJECT_ROOT / "model" / "label_encoder.pkl"
# Silence: if mean RMS below this, return normal (no cry)
ENERGY_THRESHOLD = 0.002
# If confidence below this, return cry_type but reason_suggested: false
CONFIDENCE_THRESHOLD = 0.35

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# APP & MODEL (loaded once at startup)
# ---------------------------------------------------------------------------
app = FastAPI(title="Carelum Cry API", version="1.0")

_model = None
_label_encoder = None


@app.on_event("startup")
def load_model_at_startup():
    """Load CNN model and label encoder once when the server starts."""
    global _model, _label_encoder
    try:
        _model = tf.keras.models.load_model(str(MODEL_PATH))
        with open(LABEL_ENCODER_PATH, "rb") as f:
            _label_encoder = pickle.load(f)
        logger.info("Model and label encoder loaded successfully.")
    except Exception as e:
        logger.error("Failed to load model at startup: %s", e)
        raise


def get_model():
    if _model is None or _label_encoder is None:
        raise RuntimeError("Model not loaded")
    return _model, _label_encoder


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    """Health check for the app and dev tools."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# POST /predict — Carelum contract
# ---------------------------------------------------------------------------
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Accept audio upload (multipart/form-data, field name: file).
    Supports wav, m4a, mp4 (via librosa/audioread).
    Returns JSON per Carelum contract: cry_type, confidence_score, reason_suggested.
    """
    temp_path = None
    try:
        # 1. Receive uploaded file
        if not file.filename:
            logger.warning("Received request with no filename")
            return JSONResponse(status_code=400, content={"detail": "invalid audio: missing file"})
        logger.info("Received audio: %s", file.filename)

        contents = await file.read()
        if not contents:
            return JSONResponse(status_code=400, content={"detail": "invalid audio: empty file"})

        # 2. Save temporarily
        suffix = Path(file.filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(contents)
            temp_path = tmp.name

        # 3–4. Load and preprocess for energy + mel
        try:
            y, sr = librosa.load(temp_path, sr=SR, mono=True)
        except Exception as e:
            logger.warning("Failed to load audio: %s", e)
            return JSONResponse(status_code=422, content={"detail": "processing error: could not load audio"})

        y = np.asarray(y, dtype=np.float64)
        if y.ndim > 1:
            y = np.mean(y, axis=1)

        # 5. Detect silence (energy)
        energy = float(np.mean(librosa.feature.rms(y=y)))
        logger.info("energy=%.6f", energy)

        if energy < ENERGY_THRESHOLD:
            logger.info("decision: silence -> normal")
            return {
                "cry_type": "normal",
                "confidence_score": 0,
                "reason_suggested": False,
            }

        # 6. Convert to format required by model: preprocess -> Mel -> CNN input -> batch
        y_processed = preprocess_audio_array(y, sr=sr, duration_sec=DURATION_SEC)
        mel = extract_mel_spectrogram(y_processed, SR)
        x = mel_spectrogram_to_cnn_input(mel)
        x_batch = np.expand_dims(x, axis=0)

        # 7. Run model prediction
        model, label_encoder = get_model()
        preds = model.predict(x_batch, verbose=0)
        pred_index = int(np.argmax(preds[0]))
        confidence = float(np.max(preds[0]))
        label = label_encoder.inverse_transform([pred_index])[0]

        logger.info("predicted label=%s confidence=%.4f", label, confidence)

        # 8. Confidence filter
        if confidence < CONFIDENCE_THRESHOLD:
            logger.info("decision: low confidence -> reason_suggested=false")
            return {
                "cry_type": label,
                "confidence_score": confidence,
                "reason_suggested": False,
            }

        # 9. Success: high-confidence cry
        logger.info("decision: cry detected -> reason_suggested=true")
        return {
            "cry_type": label,
            "confidence_score": confidence,
            "reason_suggested": True,
        }

    except RuntimeError as e:
        logger.error("Model not available: %s", e)
        return JSONResponse(status_code=500, content={"detail": "internal error: model not loaded"})
    except Exception as e:
        logger.exception("Unexpected error in /predict")
        return JSONResponse(status_code=500, content={"detail": f"internal error: {e!s}"})
    finally:
        if temp_path and Path(temp_path).is_file():
            try:
                Path(temp_path).unlink()
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
