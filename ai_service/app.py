"""
=============================================================================
BABY CRY DETECTION AI MICROSERVICE
=============================================================================
Model: https://huggingface.co/foduucom/baby-cry-classification
Prediction classes: belly pain | burping | discomfort | hungry | tired

Architecture: Mobile App -> Backend API -> This AI Microservice -> Database
=============================================================================

STEP 1 — CREATE AI SERVICE
  - app.py (this file), requirements.txt, model.joblib, label.joblib

STEP 3 — BUILD AI MICROSERVICE
  1. Load pretrained model (model.joblib)
  2. Load label encoder (label.joblib)
  3. Accept uploaded audio files
  4. Extract acoustic features (librosa)
  5. Run prediction
  6. Return predicted cry type

STEP 4 — AUDIO FEATURE EXTRACTION (librosa)
  - MFCC (40 coefficients), Mel Spectrogram, Chroma STFT,
    Spectral Contrast, Tonnetz. Load at 16kHz, average over time, concatenate.

STEP 5 — PREDICTION ENDPOINT: POST /predict
  - Input: multipart/form-data, field "file" (.wav)
  - Output: { "cry_type": "hungry" }

STEP 6 — RUN: uvicorn app:app --reload --port 8000
  - Test: http://localhost:8000/docs

STEP 10 — ERROR HANDLING
  - Invalid audio format, feature extraction failure, model prediction error.
=============================================================================
"""

from pathlib import Path

import joblib
import librosa
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile

# ---------------------------------------------------------------------------
# Feature extraction parameters (must match training pipeline)
# ---------------------------------------------------------------------------
SAMPLE_RATE = 16000  # Load audio at 16kHz
N_FFT = 2048
HOP_LENGTH = 512
WIN_LENGTH = 2048
WINDOW = "hann"
N_MELS = 128
N_MFCC = 40   # MFCC coefficients
# n_bands=7 -> 8 contrast values -> 194 features (matches trained SVC)
N_BANDS = 7
# fmin must be positive for librosa spectral_contrast (e.g. 20 Hz)
FMIN = 20.0

MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / "model.joblib"
LABEL_PATH = MODEL_DIR / "label.joblib"

app = FastAPI(
    title="Baby Cry Classification API",
    description="Classify baby cry audio: belly pain, burping, discomfort, hungry, tired",
    version="1.0.0",
)

# STEP 3.1–3.2: Model and label encoder (loaded at startup)
loaded_model = None
loaded_le = None


def extract_features(audio_path: str | Path) -> np.ndarray | None:
    """
    STEP 4 — AUDIO FEATURE EXTRACTION
    Load audio at 16kHz, compute features with librosa, average across time,
    concatenate into one 1D vector for the trained model.
    """
    try:
        # 1. Load audio with sample rate 16000
        y, sr = librosa.load(audio_path, sr=SAMPLE_RATE)
        stft = np.abs(
            librosa.stft(
                y, n_fft=N_FFT, hop_length=HOP_LENGTH,
                win_length=WIN_LENGTH, window=WINDOW,
            )
        )

        # 2. Compute features
        # MFCC (40 coefficients)
        mfcc = np.mean(
            librosa.feature.mfcc(
                y=y, sr=sr, n_mfcc=N_MFCC,
                n_fft=N_FFT, hop_length=HOP_LENGTH,
                win_length=WIN_LENGTH, window=WINDOW,
            ).T,
            axis=0,
        )
        # Mel Spectrogram
        mel = np.mean(
            librosa.feature.melspectrogram(
                y=y, sr=sr,
                n_fft=N_FFT, hop_length=HOP_LENGTH,
                win_length=WIN_LENGTH, window=WINDOW,
                n_mels=N_MELS,
            ).T,
            axis=0,
        )
        # Chroma STFT
        chroma = np.mean(
            librosa.feature.chroma_stft(S=stft, y=y, sr=sr).T,
            axis=0,
        )
        # Spectral Contrast
        contrast = np.mean(
            librosa.feature.spectral_contrast(
                S=stft, y=y, sr=sr,
                n_fft=N_FFT, hop_length=HOP_LENGTH, win_length=WIN_LENGTH,
                n_bands=N_BANDS, fmin=FMIN,
            ).T,
            axis=0,
        )
        # Tonnetz
        tonnetz = np.mean(
            librosa.feature.tonnetz(y=y, sr=sr).T,
            axis=0,
        )

        # 3. Average across time (already done per feature above)
        # 4. Concatenate into one vector
        features = np.concatenate((mfcc, chroma, mel, contrast, tonnetz))
        return features
    except Exception:
        # STEP 10: Feature extraction failure
        return None


@app.on_event("startup")
def startup():
    """STEP 3.1–3.2: Load pretrained model and label encoder at startup."""
    global loaded_model, loaded_le
    if not MODEL_PATH.exists() or not LABEL_PATH.exists():
        raise FileNotFoundError(
            "model.joblib and label.joblib not found. Run: python download_models.py"
        )
    loaded_model = joblib.load(MODEL_PATH)
    loaded_le = joblib.load(LABEL_PATH)


@app.get("/health")
def health():
    """Health check for load balancers / backend."""
    return {"status": "ok", "service": "baby-cry-classification"}


async def _predict_from_upload(upload: UploadFile) -> str:
    """
    Save upload to temp file, extract features, classify, return cry type.
    STEP 10: Raise HTTPException for invalid format or feature extraction failure.
    """
    # Invalid audio format
    if not upload.content_type or not upload.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_AUDIO_FORMAT",
                    "message": "File must be an audio type (e.g. audio/wav, audio/mpeg).",
                },
            },
        )
    suffix = Path(upload.filename or "audio").suffix or ".wav"
    tmp_path = MODEL_DIR / f"_tmp_upload{suffix}"
    try:
        content = await upload.read()
        tmp_path.write_bytes(content)
        features = extract_features(tmp_path)
        # Feature extraction failure
        if features is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "error": {
                        "code": "FEATURE_EXTRACTION_FAILED",
                        "message": "Could not extract features from audio (invalid or unsupported format).",
                    },
                },
            )
        features = features.reshape(1, -1)
        try:
            prediction = loaded_model.predict(features)
            cry_type = loaded_le.inverse_transform(prediction)[0]
        except Exception as e:
            # Model prediction error
            raise HTTPException(
                status_code=500,
                detail={
                    "success": False,
                    "error": {
                        "code": "MODEL_PREDICTION_ERROR",
                        "message": f"Model prediction failed: {str(e)}",
                    },
                },
            ) from e
        return cry_type
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass


@app.post("/classify")
async def classify_cry(audio: UploadFile = File(...)):
    """Legacy endpoint: returns prediction and class."""
    predicted_label = await _predict_from_upload(audio)
    return {
        "prediction": predicted_label,
        "class": predicted_label,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(..., description="WAV audio file")):
    """
    STEP 5 — PREDICTION ENDPOINT
    POST /predict — multipart/form-data, field "file" (.wav).
    Process: save file -> extract features -> reshape -> predict -> decode label.
    Returns: { "cry_type": "hungry" } (or belly pain, burping, discomfort, tired).
    """
    cry_type = await _predict_from_upload(file)
    return {"cry_type": cry_type}


if __name__ == "__main__":
    import uvicorn
    # STEP 6 — Run AI server: uvicorn app:app --reload --port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
