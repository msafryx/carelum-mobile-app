"""
Audio augmentation for balancing: time stretch, pitch shift, background noise.
Used to oversample minority classes.
"""

import numpy as np
import librosa

from .audio_preprocessing import SR


def time_stretch(y: np.ndarray, rate: float | None = None) -> np.ndarray:
    """Time stretch by rate. If rate is None, sample from [0.9, 1.1]."""
    if rate is None:
        rate = np.random.uniform(0.9, 1.1)
    return librosa.effects.time_stretch(y, rate=rate)


def pitch_shift(y: np.ndarray, sr: int = SR, n_semitones: float | None = None) -> np.ndarray:
    """Pitch shift by n_semitones. If None, sample from [-2, 2]."""
    if n_semitones is None:
        n_semitones = np.random.uniform(-2, 2)
    return librosa.effects.pitch_shift(y, sr=sr, n_steps=n_semitones)


def add_background_noise(y: np.ndarray, noise_factor: float | None = None) -> np.ndarray:
    """Add Gaussian white noise. noise_factor scales the noise (e.g. 0.01–0.05)."""
    if noise_factor is None:
        noise_factor = np.random.uniform(0.01, 0.05)
    noise = np.random.randn(len(y)).astype(np.float32) * noise_factor
    return (y + noise).astype(np.float32)


def augment_audio(y: np.ndarray, sr: int = SR, apply_noise: bool = True) -> np.ndarray:
    """
    Apply random augmentation: time stretch and/or pitch shift and/or noise.
    Returns augmented copy of y (same length; stretch/shift may trim/pad to preserve length).
    """
    # Time stretch can change length; we'll trim/pad to original length for consistency
    orig_len = len(y)
    y = time_stretch(y)
    y = pitch_shift(y, sr=sr)
    if apply_noise:
        y = add_background_noise(y)
    if len(y) > orig_len:
        y = y[:orig_len]
    elif len(y) < orig_len:
        y = np.pad(y, (0, orig_len - len(y)), mode="constant", constant_values=0.0)
    return y.astype(np.float32)
