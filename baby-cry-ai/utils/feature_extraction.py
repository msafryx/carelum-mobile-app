"""
Feature extraction for baby cry classification.
Extracts MFCC (40), Mel Spectrogram, Chroma, Spectral Contrast, Tonnetz
and returns a combined numpy feature vector/image for the CNN (Mel spec).
"""

import numpy as np
import librosa

from .audio_preprocessing import load_and_preprocess, SR, DURATION_SEC

# Feature config
N_MFCC = 40
N_MELS = 128
HOP_LENGTH = 512
N_FFT = 2048


def extract_mel_spectrogram(y: np.ndarray, sr: int = SR) -> np.ndarray:
    """
    Compute log-Mel spectrogram for CNN input.
    Returns shape (n_mels, time_frames) for single channel image.
    """
    mel = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_mels=N_MELS,
        hop_length=HOP_LENGTH,
        n_fft=N_FFT,
        fmin=0,
        fmax=sr // 2,
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)
    return log_mel.astype(np.float32)


def extract_all_features(y: np.ndarray, sr: int = SR) -> np.ndarray:
    """
    Extract MFCC (40), Mel (flattened), Chroma, Spectral Contrast, Tonnetz
    and concatenate into a single feature vector. Useful for non-CNN models.
    Returns 1D numpy array.
    """
    # MFCC
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC, n_fft=N_FFT, hop_length=HOP_LENGTH)
    mfcc_flat = np.mean(mfcc, axis=1)

    # Mel
    mel = librosa.feature.melspectrogram(
        y=y, sr=sr, n_mels=N_MELS, hop_length=HOP_LENGTH, n_fft=N_FFT
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)
    mel_flat = np.mean(log_mel, axis=1)

    # Chroma
    chroma = librosa.feature.chroma_stft(y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH)
    chroma_flat = np.mean(chroma, axis=1)

    # Spectral contrast
    contrast = librosa.feature.spectral_contrast(
        y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH
    )
    contrast_flat = np.mean(contrast, axis=1)

    # Tonnetz
    tonnetz = librosa.feature.tonnetz(
        y=librosa.effects.harmonic(y), sr=sr
    )
    tonnetz_flat = np.mean(tonnetz, axis=1)

    return np.concatenate([mfcc_flat, mel_flat, chroma_flat, contrast_flat, tonnetz_flat])


def audio_path_to_mel_spectrogram(audio_path: str) -> np.ndarray | None:
    """
    Load audio, preprocess, and return log-Mel spectrogram for CNN.
    Returns array of shape (n_mels, time_frames) or None on failure.
    """
    y = load_and_preprocess(audio_path, sr=SR, duration_sec=DURATION_SEC)
    if y is None:
        return None
    return extract_mel_spectrogram(y, SR)


def mel_spectrogram_to_cnn_input(mel: np.ndarray) -> np.ndarray:
    """
    Convert (n_mels, time) to (height, width, 1) for Keras Conv2D.
    """
    # (n_mels, time) -> (n_mels, time, 1)
    return np.expand_dims(mel, axis=-1)
