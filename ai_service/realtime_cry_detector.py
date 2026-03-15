"""
Realtime Baby Cry Detector — test the baby cry classification model with live microphone input.

Uses: sounddevice, numpy, librosa, joblib (and scikit-learn via the loaded model).

Flow:
  1. Load pretrained model.joblib and label.joblib
  2. Continuously record audio in 3-second windows at 16000 Hz
  3. Convert each window to a numpy array and extract features
  4. Run the classifier and print the predicted cry type

Expected output:
  Listening...
  Detected cry type: hungry
"""

import sys
import warnings
from pathlib import Path

import joblib
import librosa
import numpy as np
import sounddevice as sd

# Suppress scikit-learn version mismatch when loading model trained with different sklearn
warnings.filterwarnings("ignore", message="Trying to unpickle estimator", category=UserWarning, module="sklearn")
# Suppress librosa "empty frequency set" warning (happens on silence / quiet audio)
warnings.filterwarnings("ignore", message="Trying to estimate tuning from empty frequency set", category=UserWarning, module="librosa")

# ---------------------------------------------------------------------------
# Paths to pretrained files (same directory as this script)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_PATH = SCRIPT_DIR / "model.joblib"
LABEL_PATH = SCRIPT_DIR / "label.joblib"

# ---------------------------------------------------------------------------
# Recording settings
# ---------------------------------------------------------------------------
SAMPLE_RATE = 16000   # 3. Use a sampling rate of 16000 Hz (matches model training)
WINDOW_SECONDS = 3    # 2. Record audio in 3 second windows
BLOCK_SAMPLES = int(SAMPLE_RATE * WINDOW_SECONDS)  # 48000 samples per window

# ---------------------------------------------------------------------------
# Feature extraction parameters (must match app.py / training pipeline)
# ---------------------------------------------------------------------------
N_FFT = 2048
HOP_LENGTH = 512
WIN_LENGTH = 2048
WINDOW = "hann"
N_MELS = 128
N_MFCC = 40
# n_bands=7 gives 8 contrast values -> 194 total features (model expects 194)
N_BANDS = 7
# fmin must be positive for librosa's spectral_contrast (e.g. 20 Hz)
FMIN = 20.0


def load_model_and_encoder():
    """
    Load the pretrained baby cry classifier and label encoder.
    Files: model.joblib, label.joblib
    """
    if not MODEL_PATH.exists():
        print(f"Error: {MODEL_PATH} not found. Run: python download_models.py")
        sys.exit(1)
    if not LABEL_PATH.exists():
        print(f"Error: {LABEL_PATH} not found. Run: python download_models.py")
        sys.exit(1)
    model = joblib.load(MODEL_PATH)
    label_encoder = joblib.load(LABEL_PATH)
    return model, label_encoder


def extract_features_from_audio(y: np.ndarray, sr: int) -> np.ndarray | None:
    """
    Extract acoustic features from a numpy array (same pipeline as app.py).
    Uses: MFCC (40), Mel spectrogram, Chroma STFT, Spectral contrast, Tonnetz.
    Averages over time and concatenates into one vector for the classifier.
    """
    if y is None or len(y) < 512:
        return None
    # Librosa expects float64; ensure we don't pass float16 or wrong dtype
    y = np.asarray(y, dtype=np.float64)
    if y.ndim > 1:
        y = np.squeeze(y)
    try:
        # Short-time Fourier transform (used for chroma and spectral contrast)
        stft = np.abs(
            librosa.stft(
                y, n_fft=N_FFT, hop_length=HOP_LENGTH,
                win_length=WIN_LENGTH, window=WINDOW,
            )
        )
        # MFCC (40 coefficients)
        mfcc = np.mean(
            librosa.feature.mfcc(
                y=y, sr=sr, n_mfcc=N_MFCC,
                n_fft=N_FFT, hop_length=HOP_LENGTH,
                win_length=WIN_LENGTH, window=WINDOW,
            ).T,
            axis=0,
        )
        # Mel spectrogram
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
        # Spectral contrast
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
        features = np.concatenate((mfcc, chroma, mel, contrast, tonnetz))
        # Handle NaN/Inf from silence or numerical edge cases so the model still gets valid input
        if not np.isfinite(features).all():
            np.nan_to_num(features, copy=False, nan=0.0, posinf=0.0, neginf=0.0)
        return features
    except Exception as e:
        # Log once so user can see why extraction failed (e.g. wrong shape, NaN, librosa error)
        print(f"(Feature extraction failed: {e})")
        return None


def record_window() -> np.ndarray:
    """
    Record one 3-second window from the default microphone.
    Convert the microphone recording into a numpy array (float32, shape (samples,)).
    Returns audio in [-1, 1] for librosa.
    """
    recording = sd.rec(
        frames=BLOCK_SAMPLES,
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        blocking=True,
    )
    # Remove channel dimension -> shape (BLOCK_SAMPLES,) for librosa
    out = np.squeeze(recording)
    # Ensure contiguous 1D array (avoids shape/dtype issues in librosa)
    if out.ndim == 0:
        out = np.expand_dims(out, 0)
    return np.ascontiguousarray(out)


def main():
    # Step 1: Load pretrained model and label encoder
    print("Loading model and label encoder...")
    model, label_encoder = load_model_and_encoder()
    print("Model loaded. Starting realtime detection.\n")

    print("Listening... (Ctrl+C to stop)")
    print("Only printing when the detected cry type changes.\n")
    last_cry_type = None
    try:
        while True:
            # Step 2: Record one 3-second window from the microphone
            audio_float = record_window()
            # audio_float is already a numpy array at 16000 Hz, float32

            # Step 3: Extract audio features (same as training / app.py)
            features = extract_features_from_audio(audio_float, SAMPLE_RATE)
            if features is None:
                print("(Could not extract features from this window, skipping)")
                continue

            # Step 4: Run the baby cry classifier
            features_2d = features.reshape(1, -1)
            pred_index = model.predict(features_2d)
            cry_type = label_encoder.inverse_transform(pred_index)[0]

            # Step 5: Print only when the predicted cry type changes (reduces console spam)
            if cry_type != last_cry_type:
                print(f"Detected cry type: {cry_type}")
                last_cry_type = cry_type
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
