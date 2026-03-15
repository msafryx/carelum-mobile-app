#!/usr/bin/env python3
"""
Baby cry classification: full training pipeline.
Combines multiple datasets, normalizes labels, balances classes,
trains a CNN on Mel spectrograms, and saves model + evaluation.
"""

import os
import sys
import pickle
import random
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
)
from sklearn.preprocessing import LabelEncoder
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Add project root so we can import utils
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.data_loader import load_dataset_dataframe, get_class_distribution, UNIFIED_LABELS
from utils.audio_preprocessing import load_and_preprocess, SR, DURATION_SEC
from utils.feature_extraction import (
    extract_mel_spectrogram,
    mel_spectrogram_to_cnn_input,
    N_MELS,
    HOP_LENGTH,
    N_FFT,
)
from utils.audio_augmentation import augment_audio

# ---------------------------------------------------------------------------
# PATHS
# ---------------------------------------------------------------------------
DATASETS_ROOT = PROJECT_ROOT / "datasets"
MODEL_DIR = PROJECT_ROOT / "model"
EVAL_DIR = PROJECT_ROOT / "evaluation"
MODEL_PATH = MODEL_DIR / "baby_cry_cnn_model.h5"
LABEL_ENCODER_PATH = MODEL_DIR / "label_encoder.pkl"

# ---------------------------------------------------------------------------
# TRAINING CONFIG
# ---------------------------------------------------------------------------
EPOCHS = 40
BATCH_SIZE = 32
RANDOM_SEED = 42
TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

# Reproducibility
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)
tf.random.set_seed(RANDOM_SEED)


def build_mel_from_path(audio_path: str) -> np.ndarray | None:
    """Load audio, preprocess, compute log-Mel spectrogram for CNN. Returns (H, W) or None."""
    y = load_and_preprocess(audio_path, sr=SR, duration_sec=DURATION_SEC)
    if y is None:
        return None
    return extract_mel_spectrogram(y, SR)


def build_spectrogram_dataset(
    df: pd.DataFrame,
    label_encoder: LabelEncoder,
    verbose: bool = True,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Build X (mel spectrograms) and y (encoded labels) from dataframe.
    Skips files that fail to load. Returns (X, y) as numpy arrays.
    """
    X_list = []
    y_list = []
    skipped = 0
    for i, row in df.iterrows():
        mel = build_mel_from_path(row["file_path"])
        if mel is None:
            skipped += 1
            continue
        x = mel_spectrogram_to_cnn_input(mel)  # (H, W, 1)
        X_list.append(x)
        y_list.append(row["label"])
    if verbose:
        print(f"  Built {len(X_list)} spectrograms, skipped {skipped} files.")
    X = np.stack(X_list, axis=0)
    y = label_encoder.transform(y_list)
    return X, np.array(y, dtype=np.int32)


def balance_dataset(
    df: pd.DataFrame,
    strategy: str = "median",
    augment_minority: bool = True,
    max_augment_per_sample: int = 3,
) -> pd.DataFrame:
    """
    Balance classes: undersample majority and/or oversample minority with augmentation.
    strategy: "min" (undersample to min count), "median" (target = median count).
    Returns a new dataframe with (file_path, label) plus synthetic rows marked.
    For synthetic we store (path=None, label=..., audio_array=...) - actually we need
    to return something we can use. Simpler: return two things - (1) balanced df with
    only real paths, (2) list of (augmented_mel, label) for synthetic. So we have
    balanced_df for real, and list of (mel, label) for augmented. Then we build X,y
    from balanced_df + augmented list.
    Actually simpler: just return a balanced dataframe where we only have file_path and
    label. For oversampling we don't add rows to the dataframe; we'll generate
    augmented samples when building X,y. So: balance_dataset returns a dataframe
    that is undersampled to target per class. Then in the pipeline we'll separately
    add augmented samples for classes that are below target. So we need:
    - balanced_df (undersampled, so each class has at most target_count)
    - For each class with count < target_count, we need (target_count - count) extra
      samples. We get them by loading random files from that class, augmenting, mel.
    So balance_dataset can return: (df_balanced, target_count). Then we have a
    function that takes (df_balanced, target_count) and returns (X, y) including
    augmented samples. Let me implement that in the main script instead of here.
    """
    counts = df["label"].value_counts()
    if strategy == "min":
        target_count = int(counts.min())
    else:
        target_count = int(counts.median())
    target_count = max(1, target_count)
    balanced_rows = []
    for label in counts.index:
        sub = df[df["label"] == label]
        n = len(sub)
        if n >= target_count:
            chosen = sub.sample(n=target_count, random_state=RANDOM_SEED)
        else:
            chosen = sub
        balanced_rows.append(chosen)
    return pd.concat(balanced_rows, ignore_index=True), target_count


def add_augmented_samples(
    df: pd.DataFrame,
    target_per_class: int,
    label_encoder: LabelEncoder,
) -> tuple[list, list]:
    """
    For each class with count < target_per_class, generate augmented mel specs
    until we reach target_per_class. Returns (X_extra list, y_extra list).
    """
    X_extra = []
    y_extra = []
    for label in df["label"].unique():
        sub = df[df["label"] == label]
        need = target_per_class - len(sub)
        if need <= 0:
            continue
        paths = sub["file_path"].tolist()
        for _ in range(need):
            path = random.choice(paths)
            y_audio = load_and_preprocess(path, sr=SR, duration_sec=DURATION_SEC)
            if y_audio is None:
                continue
            y_aug = augment_audio(y_audio, sr=SR)
            mel = extract_mel_spectrogram(y_aug, SR)
            x = mel_spectrogram_to_cnn_input(mel)
            X_extra.append(x)
            y_extra.append(label)
    if y_extra:
        y_encoded = label_encoder.transform(y_extra)
        return X_extra, np.array(y_encoded, dtype=np.int32)
    return [], np.array([], dtype=np.int32)


def build_cnn_model(input_shape: tuple, num_classes: int) -> keras.Model:
    """CNN for Mel spectrogram: Conv2D(32)->ReLU->MaxPool, Conv2D(64)->..., Conv2D(128)->..., Flatten->Dense(128)->Dropout->Softmax."""
    model = keras.Sequential([
        layers.Input(shape=input_shape),
        layers.Conv2D(32, (3, 3), activation="relu"),
        layers.MaxPooling2D((2, 2)),
        layers.Conv2D(64, (3, 3), activation="relu"),
        layers.MaxPooling2D((2, 2)),
        layers.Conv2D(128, (3, 3), activation="relu"),
        layers.MaxPooling2D((2, 2)),
        layers.Flatten(),
        layers.Dense(128, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation="softmax"),
    ])
    return model


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(EVAL_DIR, exist_ok=True)

    print("=" * 60)
    print("BABY CRY CLASSIFICATION — TRAINING PIPELINE")
    print("=" * 60)

    # ----- STEP 2 — Load dataset -----
    print("\n[STEP 2] Loading dataset...")
    df = load_dataset_dataframe(DATASETS_ROOT)
    if df.empty:
        print("ERROR: No audio files found. Check datasets root:", DATASETS_ROOT)
        return 1
    print(f"  Total audio files loaded: {len(df)}")
    dist_before = get_class_distribution(df)
    print("  Class distribution (before balance):")
    for label, count in dist_before.items():
        print(f"    {label}: {count}")

    # Label encoder fitted on unified labels present in data
    classes = sorted(df["label"].unique().tolist())
    label_encoder = LabelEncoder()
    label_encoder.fit(classes)
    num_classes = len(classes)
    print(f"  Number of classes: {num_classes}")

    # ----- Balance -----
    print("\n[STEP 5] Balancing dataset...")
    df_balanced, target_count = balance_dataset(df, strategy="median")
    dist_balanced = get_class_distribution(df_balanced)
    print(f"  Target samples per class (median): {target_count}")
    print("  Distribution after undersampling:")
    for label, count in dist_balanced.items():
        print(f"    {label}: {count}")

    # Build spectrograms for balanced real data
    print("\n  Building Mel spectrograms for real samples...")
    X_real, y_real = build_spectrogram_dataset(df_balanced, label_encoder, verbose=True)

    # Add augmented samples for minority classes
    print("  Adding augmented samples for minority classes...")
    X_extra, y_extra = add_augmented_samples(df_balanced, target_count, label_encoder)
    if len(X_extra) > 0:
        X_extra_arr = np.stack(X_extra, axis=0)
        X_all = np.concatenate([X_real, X_extra_arr], axis=0)
        y_all = np.concatenate([y_real, y_extra], axis=0)
        print(f"  Added {len(X_extra)} augmented samples. Total: {len(y_all)}")
    else:
        X_all, y_all = X_real, y_real

    # Shuffle
    idx = np.random.permutation(len(y_all))
    X_all = X_all[idx]
    y_all = y_all[idx]
    # STEP 13 — Training progress: show balance after augmentation
    labels_named = label_encoder.inverse_transform(y_all)
    balance_after = Counter(labels_named)
    print("  Dataset balance after augmentation:")
    for label in sorted(balance_after.keys()):
        print(f"    {label}: {balance_after[label]}")
    y_categorical = keras.utils.to_categorical(y_all, num_classes=num_classes)

    # ----- STEP 6 — Train/Val/Test split -----
    print("\n[STEP 6] Stratified train/validation/test split (70/15/15)...")
    X_train, X_rest, y_train, y_rest = train_test_split(
        X_all, y_categorical, test_size=(1 - TRAIN_RATIO), stratify=y_all, random_state=RANDOM_SEED
    )
    val_ratio_adj = VAL_RATIO / (VAL_RATIO + TEST_RATIO)
    X_val, X_test, y_val, y_test = train_test_split(
        X_rest, y_rest, test_size=(1 - val_ratio_adj), stratify=np.argmax(y_rest, axis=1), random_state=RANDOM_SEED
    )
    print(f"  Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    # ----- STEP 7 — Build model -----
    print("\n[STEP 7] Building CNN model...")
    input_shape = X_train.shape[1:]
    model = build_cnn_model(input_shape, num_classes)
    model.compile(
        optimizer="adam",
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    # ----- STEP 8 — Training -----
    print("\n[STEP 8] Training (epochs={}, batch_size={})...".format(EPOCHS, BATCH_SIZE))
    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            patience=8,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=4,
            min_lr=1e-6,
            verbose=1,
        ),
    ]
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1,
    )

    # ----- STEP 9 — Evaluation -----
    print("\n[STEP 9] Evaluation on test set...")
    y_pred_proba = model.predict(X_test)
    y_pred = np.argmax(y_pred_proba, axis=1)
    y_true = np.argmax(y_test, axis=1)
    acc = accuracy_score(y_true, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="weighted", zero_division=0
    )
    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    cm = confusion_matrix(y_true, y_pred)
    print("  Confusion matrix (counts):")
    print(cm)

    # Plots
    class_names = label_encoder.classes_.tolist()
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].plot(history.history["loss"], label="Train loss")
    axes[0].plot(history.history["val_loss"], label="Val loss")
    axes[0].set_xlabel("Epoch")
    axes[0].set_title("Training loss")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)
    axes[1].plot(history.history["accuracy"], label="Train accuracy")
    axes[1].plot(history.history["val_accuracy"], label="Val accuracy")
    axes[1].set_xlabel("Epoch")
    axes[1].set_title("Validation accuracy")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(EVAL_DIR / "training_curve.png", dpi=150)
    plt.close()
    print(f"  Saved {EVAL_DIR / 'training_curve.png'}")

    plt.figure(figsize=(10, 8))
    plt.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    plt.colorbar()
    plt.xticks(np.arange(num_classes), class_names, rotation=45, ha="right")
    plt.yticks(np.arange(num_classes), class_names)
    plt.xlabel("Predicted")
    plt.ylabel("True")
    plt.title("Confusion matrix")
    for i in range(num_classes):
        for j in range(num_classes):
            plt.text(j, i, str(cm[i, j]), ha="center", va="center", color="white" if cm[i, j] > cm.max() / 2 else "black")
    plt.tight_layout()
    plt.savefig(EVAL_DIR / "confusion_matrix.png", dpi=150)
    plt.close()
    print(f"  Saved {EVAL_DIR / 'confusion_matrix.png'}")

    # ----- STEP 10 — Save model -----
    print("\n[STEP 10] Saving model and label encoder...")
    model.save(MODEL_PATH)
    with open(LABEL_ENCODER_PATH, "wb") as f:
        pickle.dump(label_encoder, f)
    print(f"  Model: {MODEL_PATH}")
    print(f"  Label encoder: {LABEL_ENCODER_PATH}")

    print("\n" + "=" * 60)
    print("Training complete.")
    print("Use predict_cry(audio_path) for inference.")
    print("=" * 60)
    return 0


def predict_cry(audio_path: str) -> dict:
    """
    Load audio, extract Mel spectrogram, run CNN, return predicted cry label and confidence.
    Returns e.g. {"cry_type": "hungry", "confidence": 0.87}.
    """
    model_path = PROJECT_ROOT / "model" / "baby_cry_cnn_model.h5"
    encoder_path = PROJECT_ROOT / "model" / "label_encoder.pkl"
    if not model_path.is_file() or not encoder_path.is_file():
        raise FileNotFoundError("Model or label encoder not found. Train first with train_baby_cry_model.py")
    model = keras.models.load_model(model_path)
    with open(encoder_path, "rb") as f:
        label_encoder = pickle.load(f)
    mel = build_mel_from_path(audio_path)
    if mel is None:
        return {"cry_type": None, "confidence": 0.0, "error": "Failed to load or process audio"}
    x = mel_spectrogram_to_cnn_input(mel)
    x = np.expand_dims(x, axis=0)
    proba = model.predict(x, verbose=0)[0]
    idx = int(np.argmax(proba))
    return {
        "cry_type": label_encoder.inverse_transform([idx])[0],
        "confidence": float(proba[idx]),
    }


if __name__ == "__main__":
    sys.exit(main())
