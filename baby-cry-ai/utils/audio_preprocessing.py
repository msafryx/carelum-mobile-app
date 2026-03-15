"""
Audio preprocessing for baby cry classification.
Uses librosa: load at 16kHz, mono, trim silence, normalize, fixed length 4s.
"""

import numpy as np
import librosa


# Target sample rate and duration
SR = 16000
DURATION_SEC = 4.0
TARGET_LEN = int(SR * DURATION_SEC)


def load_and_preprocess(
    audio_path: str,
    sr: int = SR,
    duration_sec: float = DURATION_SEC,
    trim_silence: bool = True,
    top_db: int = 20,
) -> np.ndarray | None:
    """
    Load audio at given sr, convert to mono, optionally trim silence,
    normalize, and fix length to duration_sec (pad or trim).

    Returns:
        1D numpy array of shape (TARGET_LEN,) or None if load fails.
    """
    try:
        y, _ = librosa.load(audio_path, sr=sr, mono=True)
    except Exception:
        return None

    if trim_silence and len(y) > 0:
        y, _ = librosa.effects.trim(y, top_db=top_db)

    # Normalize (peak or RMS); peak to avoid clipping
    if len(y) > 0 and np.max(np.abs(y)) > 0:
        y = y / np.max(np.abs(y))

    target_len = int(sr * duration_sec)
    if len(y) >= target_len:
        y = y[:target_len]
    else:
        # Pad with zeros at the end
        pad_len = target_len - len(y)
        y = np.pad(y, (0, pad_len), mode="constant", constant_values=0.0)

    return y.astype(np.float32)


def preprocess_audio_array(
    y: np.ndarray,
    sr: int = SR,
    duration_sec: float = DURATION_SEC,
    trim_silence: bool = True,
    top_db: int = 20,
) -> np.ndarray:
    """
    Preprocess raw audio array (e.g. from microphone): trim silence, normalize,
    and fix length to duration_sec. Same logic as load_and_preprocess but for
    in-memory audio. Use for real-time / recorded mic input.
    """
    y = np.asarray(y, dtype=np.float64)
    if y.ndim > 1:
        y = np.mean(y, axis=1)
    if sr != SR:
        y = librosa.resample(y, orig_sr=sr, target_sr=SR)
        sr = SR
    if trim_silence and len(y) > 0:
        try:
            # trim can fail on all-silence or very quiet mic input
            y, _ = librosa.effects.trim(y, top_db=top_db)
            if len(y) == 0:
                y = np.zeros(int(sr * duration_sec), dtype=np.float64)
        except Exception:
            pass  # keep y as-is (e.g. all zeros) and continue
    if len(y) > 0 and np.max(np.abs(y)) > 0:
        y = y / np.max(np.abs(y))
    target_len = int(sr * duration_sec)
    if len(y) >= target_len:
        y = y[:target_len]
    else:
        pad_len = target_len - len(y)
        y = np.pad(y, (0, pad_len), mode="constant", constant_values=0.0)
    return y.astype(np.float32)


def load_audio_for_spectrogram(
    audio_path: str,
    sr: int = SR,
    duration_sec: float = DURATION_SEC,
) -> np.ndarray | None:
    """
    Load and preprocess audio for Mel spectrogram (same pipeline as training).
    Used by feature extraction and prediction.
    """
    return load_and_preprocess(
        audio_path,
        sr=sr,
        duration_sec=duration_sec,
        trim_silence=True,
    )
