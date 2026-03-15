"""
Shared prediction logic with sound activity detection (VAD) and confidence threshold.
Returns "no_cry" for silence or low-confidence predictions to reduce false positives.
"""

import numpy as np
import librosa

from .audio_preprocessing import SR, DURATION_SEC, preprocess_audio_array
from .feature_extraction import extract_mel_spectrogram, mel_spectrogram_to_cnn_input

# Sound activity: if mean RMS below this, treat as silence (keep low so real cries/speech pass)
ENERGY_THRESHOLD = 0.002
# Prediction confidence: if max prob below this, treat as no_cry (e.g. background noise)
CONFIDENCE_THRESHOLD = 0.5

REASON_SILENCE = "Silence detected"
REASON_LOW_CONFIDENCE = "Low confidence prediction"
REASON_CRY = "Cry detected"


def predict_cry_with_vad(y: np.ndarray, sr: int, model, label_encoder):
    """
    Run VAD then model; only return a cry class if audio has enough energy
    and prediction confidence >= CONFIDENCE_THRESHOLD.

    Returns:
        (result_dict, reason_str)
        result_dict: {"cry_type": str, "confidence": float}
        reason_str: "Silence detected" | "Low confidence prediction" | "Cry detected"
    """
    y = np.asarray(y, dtype=np.float64)
    if y.ndim > 1:
        y = np.mean(y, axis=1)

    # STEP 1 — Sound activity detection (RMS energy)
    energy = np.mean(librosa.feature.rms(y=y))
    if energy < ENERGY_THRESHOLD:
        return ({"cry_type": "no_cry", "confidence": 0.0}, REASON_SILENCE)

    # Preprocess and run model
    y = preprocess_audio_array(y, sr=sr, duration_sec=DURATION_SEC)
    mel = extract_mel_spectrogram(y, SR)
    x = mel_spectrogram_to_cnn_input(mel)
    x = np.expand_dims(x, axis=0)
    proba = model.predict(x, verbose=0)[0]

    # STEP 2 — Prediction confidence threshold
    confidence = float(np.max(proba))
    if confidence < CONFIDENCE_THRESHOLD:
        return ({"cry_type": "no_cry", "confidence": confidence}, REASON_LOW_CONFIDENCE)

    # STEP 3 — Both conditions passed
    idx = int(np.argmax(proba))
    cry_type = label_encoder.inverse_transform([idx])[0]
    return ({"cry_type": cry_type, "confidence": confidence}, REASON_CRY)
