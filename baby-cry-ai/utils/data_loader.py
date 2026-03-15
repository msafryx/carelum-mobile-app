"""
Data loader for baby cry classification.
Recursively scans dataset directories, loads WAV paths, and assigns
unified labels. Ignores corrupted files.
"""

import os
import pandas as pd
from pathlib import Path

# ---------------------------------------------------------------------------
# STEP 1 — STANDARDIZED CLASS NAMES
# ---------------------------------------------------------------------------
# Unified labels used across all datasets. Folder names are normalized to these.
UNIFIED_LABELS = [
    "belly_pain",
    "burping",
    "discomfort",
    "hungry",
    "tired",
    "cold_hot",
    "lonely",
    "scared",
]

# Map variant folder names (as found in datasets) to unified label.
# Examples: "belly pain" -> belly_pain, "belly_pain" -> belly_pain
FOLDER_TO_LABEL = {
    "belly pain": "belly_pain",
    "belly_pain": "belly_pain",
    "burping": "burping",
    "discomfort": "discomfort",
    "hungry": "hungry",
    "tired": "tired",
    "cold_hot": "cold_hot",
    "cold-hot": "cold_hot",
    "lonely": "lonely",
    "scared": "scared",
}


def normalize_label(folder_name: str) -> str | None:
    """
    Convert a folder name to the unified label.
    Returns None if the folder does not correspond to a known class.
    """
    # Normalize: strip, lowercase, replace spaces with underscore
    normalized = folder_name.strip().lower().replace(" ", "_")
    return FOLDER_TO_LABEL.get(normalized) or FOLDER_TO_LABEL.get(folder_name.strip())


def is_valid_wav(path: str) -> bool:
    """Check if file exists, has .wav extension and is readable (not obviously corrupted)."""
    if not path.lower().endswith(".wav"):
        return False
    if not os.path.isfile(path):
        return False
    try:
        with open(path, "rb") as f:
            header = f.read(12)
        # WAV files start with RIFF....WAVE
        if len(header) < 12:
            return False
        if header[:4] != b"RIFF" or header[8:12] != b"WAVE":
            return False
        return True
    except Exception:
        return False


def load_dataset_dataframe(
    datasets_root: str | Path,
    extensions: tuple[str, ...] = (".wav",),
) -> pd.DataFrame:
    """
    Recursively scan dataset directories under datasets_root, load all .wav paths,
    assign labels from folder names (normalized to unified labels), and ignore
    corrupted files.

    Expects structure:
        datasets_root/
            DatasetName1/
                class_folder_1/
                    file.wav
                class_folder_2/
                    ...
            DatasetName2/
                ...

    Returns:
        DataFrame with columns: file_path, label, dataset_name
    """
    datasets_root = Path(datasets_root)
    if not datasets_root.is_dir():
        raise NotADirectoryError(f"Datasets root is not a directory: {datasets_root}")

    rows = []

    # Each top-level folder under datasets_root is a dataset (e.g. "Baby Cry Sense Dataset")
    for dataset_dir in sorted(datasets_root.iterdir()):
        if not dataset_dir.is_dir():
            continue
        dataset_name = dataset_dir.name

        # Each subfolder is a class (e.g. "belly pain", "hungry")
        for class_dir in sorted(dataset_dir.iterdir()):
            if not class_dir.is_dir():
                continue
            raw_label = class_dir.name
            unified_label = normalize_label(raw_label)
            if unified_label is None:
                continue  # Skip unknown class folders

            for file_path in class_dir.rglob("*"):
                if not file_path.is_file():
                    continue
                if file_path.suffix.lower() not in extensions:
                    continue
                path_str = str(file_path.resolve())
                if not is_valid_wav(path_str):
                    continue
                rows.append(
                    {
                        "file_path": path_str,
                        "label": unified_label,
                        "dataset_name": dataset_name,
                    }
                )

    df = pd.DataFrame(rows)
    return df


def get_class_distribution(df: pd.DataFrame) -> pd.Series:
    """Return count of samples per class (label)."""
    return df["label"].value_counts().sort_index()
