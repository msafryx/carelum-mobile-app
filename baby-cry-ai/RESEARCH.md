# Baby Cry Classification — Research & Methodology

This document explains **what** was built, **why** each choice was made, and **how** it was implemented. It serves as a full technical narrative for the baby cry classification system.

---

## 1. Problem and Goal

### What

Build an AI system that:

- Takes an audio recording (baby cry or other sound)
- Classifies the **reason** for the cry when it is a cry (e.g. hungry, tired, discomfort, belly pain)
- Avoids labelling **silence** or **background noise** (e.g. fan) as a cry type

### Why

- Parents and caregivers can use the app to get a suggested reason for the cry and act accordingly.
- The system must be reliable enough to avoid false “cry” labels on non-cry audio (silence, fan, speech).

### How (high level)

- Combine several public baby-cry datasets.
- Standardise labels and balance classes.
- Train a **CNN on Mel spectrograms** (image-like representation of audio).
- At inference: run **sound activity detection (VAD)** and a **confidence threshold** so that only clear cry-like, confident predictions are returned as a cry type; otherwise return “normal” or “no_cry”.

---

## 2. Datasets

### What

Three datasets are used:

- **Baby Cry Sense Dataset** — classes: belly pain, burping, cold_hot, discomfort, hungry, lonely, scared, tired
- **donate-a-cry** — belly_pain, burping, discomfort, hungry, tired
- **Infant Cry Corpus** — belly_pain, burping, discomfort, hungry, tired

Each dataset is organised as: `datasets/<DatasetName>/<class_folder>/*.wav`.

### Why

- Single datasets are often small or biased; combining several increases variety and sample count.
- Different naming (e.g. “belly pain” vs “belly_pain”) and different class sets require a **unified label scheme** and **robust loading** so the rest of the pipeline sees one consistent taxonomy.

### How

- **Unified labels** (in `utils/data_loader.py`):  
  We define a fixed set of class names (e.g. `belly_pain`, `burping`, `discomfort`, `hungry`, `tired`, `cold_hot`, `lonely`, `scared`) and a mapping from folder names to these labels (e.g. `"belly pain"` → `belly_pain`). Only folders that map to a known label are used.
- **Data loading**:  
  The loader recursively scans `datasets/`, collects all `.wav` paths, assigns the unified label from the parent folder name, and performs a simple WAV-header check to skip obviously corrupted files. Paths and labels are stored in a pandas DataFrame.
- **Result**:  
  One table of `(file_path, label, dataset_name)` with consistent labels across all sources. Classes that appear in only one dataset are still used; the rest of the pipeline handles class imbalance by balancing and augmentation.

---

## 3. Audio Preprocessing

### What

Every audio clip used for training and inference is:

- Loaded at **16 kHz**, **mono**
- **Trimmed** for leading/trailing silence (librosa trim, `top_db=20`)
- **Peak-normalised** (divide by max absolute value)
- **Fixed length**: 4 seconds — longer clips are truncated, shorter ones zero-padded

### Why

- **16 kHz**: Sufficient for baby cry (main energy in lower frequencies); keeps data size and compute manageable.
- **Mono**: Simplifies features and model; stereo does not add needed information for this task.
- **Trim silence**: Removes non-informative parts and focuses the model on the actual cry.
- **Normalise**: Puts different recordings on a similar scale and avoids one loud file dominating.
- **4 s**: Ensures a fixed input size for the CNN and matches typical cry segment length; padding/trimming keeps all clips the same length.

### How

- **From file**: `utils/audio_preprocessing.py` — `load_and_preprocess(audio_path, sr=16000, duration_sec=4.0)` uses librosa to load, trim, normalise, then pad or trim to `4 * sr` samples.
- **From array** (e.g. microphone): `preprocess_audio_array(y, sr)` does the same steps on an in-memory waveform (resample to 16 kHz if needed, trim, normalise, pad/trim to 4 s). This keeps training and inference pipelines aligned.

---

## 4. Feature Extraction and Mel Spectrogram

### What

The model does **not** use raw waveform. It uses a **log-Mel spectrogram**: a 2D image where:

- **X-axis**: time (frames)
- **Y-axis**: Mel frequency (128 bins)
- **Value**: log power (dB)

So each 4 s clip becomes a single “image” of shape `(128, time_frames)`.

### Why

- Baby cry is characterised by **spectral** and **temporal** patterns (pitch, intensity over time). Spectrograms capture both.
- **Mel scale** approximates human perception and is standard in speech/audio ML; 128 bins give enough resolution without huge input size.
- **Log power** compresses dynamic range and improves learning.
- A **CNN** can treat the spectrogram as an image and learn local patterns (e.g. formants, contours) that distinguish cry types.

### How

- **Computation** (in `utils/feature_extraction.py`):  
  - `extract_mel_spectrogram(y, sr)`: librosa `melspectrogram` (n_mels=128, hop_length=512, n_fft=2048), then `power_to_db`.  
  - Input: preprocessed 1D waveform `y` at 16 kHz.  
  - Output: 2D array `(n_mels, time_frames)`.
- **CNN input**:  
  `mel_spectrogram_to_cnn_input(mel)` adds a channel dimension → `(n_mels, time_frames, 1)` for Keras Conv2D.
- The same function is used in training (from preprocessed WAV) and in all inference paths (file, API, microphone).

---

## 5. Class Balancing

### What

Datasets are **imbalanced**: e.g. “hungry” has many more samples than “scared”. We:

- **Undersample** so no class has more than a target count (e.g. median of class counts).
- **Oversample** minority classes by **synthetic samples** created with audio augmentation, until each class has the same target count.

### Why

- Severe imbalance causes the model to favour the majority class and underperform on rare classes.
- Balancing (by undersampling and/or oversampling) gives the classifier a more even exposure to all cry types and usually improves per-class accuracy and F1.

### How

- **Undersampling** (`train_baby_cry_model.py`, `balance_dataset()`):  
  For each class, we randomly sample up to `target_count` (e.g. median of class counts). So we get a balanced subset of **real** clips.
- **Oversampling** (`add_augmented_samples()`):  
  For each class that has fewer than `target_count` samples after undersampling, we repeatedly:  
  - Pick a random file from that class  
  - Load and preprocess it  
  - Apply **augmentation** (time stretch, pitch shift, additive noise; see `utils/audio_augmentation.py`)  
  - Compute Mel spectrogram and add it (with the same label) to the training set  
  Until that class reaches `target_count`.  
- **Augmentation** (`utils/audio_augmentation.py`):  
  - **Time stretch**: librosa `time_stretch` (rate in [0.9, 1.1]).  
  - **Pitch shift**: librosa `pitch_shift` (e.g. ±2 semitones).  
  - **Noise**: additive Gaussian noise (e.g. factor 0.01–0.05).  
  Then clip/pad back to 4 s so input size stays fixed.  
- Training then runs on this balanced set (real + augmented), with a stratified train/validation/test split so each split keeps a similar class distribution.

---

## 6. Train / Validation / Test Split

### What

After balancing (and optional shuffling), data is split:

- **70%** training  
- **15%** validation  
- **15%** test  

Splitting is **stratified** by label.

### Why

- **Validation** is used for early stopping and learning-rate scheduling during training.
- **Test** is used only once to report final metrics (accuracy, precision, recall, F1, confusion matrix) and is not used for any training decision.
- **Stratification** keeps class proportions similar in all splits, so metrics are representative.

### How

- `sklearn.model_selection.train_test_split` with `stratify=y` (and appropriate `test_size`), applied twice to get 70/15/15. Labels are one-hot encoded for the CNN (categorical cross-entropy); the same split is used for spectrograms and labels.

---

## 7. CNN Model Architecture

### What

A small **convolutional neural network**:

- **Input**: one channel image of shape `(n_mels, time_frames, 1)` (the log-Mel spectrogram).
- **Blocks**:  
  - Conv2D(32, 3×3) → ReLU → MaxPool2D(2×2)  
  - Conv2D(64, 3×3) → ReLU → MaxPool2D(2×2)  
  - Conv2D(128, 3×3) → ReLU → MaxPool2D(2×2)  
- **Classifier**: Flatten → Dense(128, ReLU) → Dropout(0.3) → Dense(num_classes, softmax).

### Why

- **Conv2D + pooling**: Learns local spectral-temporal patterns (e.g. short bursts, pitch contours) that characterise different cry types.
- **Small depth and width**: Keeps the model fast and small enough for deployment (e.g. mobile backend) while still capturing structure in Mel images.
- **Dropout**: Reduces overfitting.
- **Softmax**: Produces a probability over the fixed set of cry classes (and “normal”/no-cry is handled at inference by VAD and confidence, not as an extra class in training).

### How

- Implemented in `train_baby_cry_model.py` with Keras Sequential API (`build_cnn_model(input_shape, num_classes)`).  
- Compiled with **Adam**, **categorical_crossentropy**, and **accuracy**.  
- Trained for up to 40 epochs, batch size 32, with **EarlyStopping** (on validation accuracy, patience 8) and **ReduceLROnPlateau** (on validation loss, factor 0.5, patience 4).  
- Best weights (by validation accuracy) are restored and the model is saved as `model/baby_cry_cnn_model.h5`.  
- Class names are encoded with `sklearn.preprocessing.LabelEncoder` and the encoder is saved as `model/label_encoder.pkl` so inference can map class index → string (e.g. `hungry`, `tired`).

---

## 8. Evaluation

### What

On the **test set** we compute:

- **Accuracy**
- **Precision, recall, F1** (e.g. weighted over classes)
- **Confusion matrix**

We also plot:

- **Training and validation loss** over epochs  
- **Training and validation accuracy** over epochs  
- **Confusion matrix** as a heatmap  

Saved under `evaluation/` (e.g. `training_curve.png`, `confusion_matrix.png`).

### Why

- These metrics show how well the model generalises to unseen data and whether some classes are confused with others.
- Plots support debugging (overfitting, underfitting) and reporting.

### How

- After training, `model.predict(X_test)` gives class probabilities; we take `argmax` for the predicted class.  
- We use `sklearn.metrics` for accuracy, precision_recall_fscore_support, and confusion_matrix.  
- Matplotlib is used to plot loss/accuracy curves and the confusion matrix heatmap; figures are saved to `evaluation/`.

---

## 9. Inference and False-Detection Prevention

### What

At inference we do **not** always return the class with the highest probability. We:

1. **Sound activity detection (VAD)**: Compute mean RMS energy of the (preprocessed or raw) audio. If it is below a threshold (e.g. 0.002), we treat the segment as **silence** and return **“normal”** or **“no_cry”** with confidence 0.
2. **Confidence threshold**: After the CNN predicts, we take `confidence = max(probabilities)`. If `confidence <` a threshold (e.g. 0.35–0.5), we return **“no_cry”** or **“normal”** (or the predicted label with `reason_suggested: false` in the Carelum API) so that uncertain predictions (e.g. fan noise) do not count as a confident cry reason.

Only when **both** “enough sound” and “enough confidence” are satisfied do we return a cry type with high confidence / `reason_suggested: true`.

### Why

- The model was trained **only on cry classes**. It has no “silence” or “fan” class, so it will always pick one of the cry labels; silence or fan can therefore get an arbitrary label with low confidence.
- By **rejecting** very quiet input (VAD) and **rejecting** low-confidence predictions (threshold), we avoid showing a misleading cry reason when the input is not a clear cry.

### How

- **VAD**: In `utils/prediction.py`, we compute `energy = np.mean(librosa.feature.rms(y=y))` on the audio (after loading or from mic). If `energy < ENERGY_THRESHOLD` (e.g. 0.002), we return `no_cry` / `normal` and do not run the CNN.  
- **Confidence**: After `model.predict()`, we set `confidence = np.max(preds)`. If `confidence < CONFIDENCE_THRESHOLD`, we return no_cry / normal or the label with `reason_suggested: false` (depending on API contract).  
- **Shared logic**: `utils/prediction.py` exposes `predict_cry_with_vad(y, sr, model, label_encoder)` used by `test_model.py`, `api_server.py`, and `listen_and_predict.py`.  
- **Carelum API** (`carelum_cry_api.py`) implements the same idea with the contract fields `cry_type`, `confidence_score`, and `reason_suggested`, and with thresholds tuned for that API (e.g. 0.002 energy, 0.35 confidence).

---

## 10. APIs and Deployment

### What

Two HTTP APIs:

1. **Generic API** (`api_server.py`, port 8002):  
   - GET `/` (health), POST `/predict` with WAV file.  
   - Returns `{ "cry_type": "...", "confidence": ... }` and uses the shared VAD + confidence logic.

2. **Carelum API** (`carelum_cry_api.py`, port 8082):  
   - GET `/health` → `{ "status": "ok" }`.  
   - POST `/predict` with audio file (wav/m4a/mp4).  
   - Returns `cry_type`, `confidence_score`, and `reason_suggested` exactly as required by the Carelum mobile app.

### Why

- **Generic API**: Flexible for testing, scripts, or other clients.  
- **Carelum API**: Guarantees the exact response shape and semantics the mobile app expects, and runs on the port (8082) and path (`/predict`) the app is configured for.

### How

- Both are **FastAPI** apps.  
- Model and label encoder are loaded **once at startup** from `model/baby_cry_cnn_model.h5` and `model/label_encoder.pkl`.  
- Uploaded file is saved to a **temporary file**, then:  
  - Loaded with librosa (resampled to 16 kHz, mono).  
  - VAD and, if passed, preprocessing → Mel spectrogram → CNN input shape → `model.predict()`.  
  - Confidence threshold applied; response is built accordingly.  
- Errors (invalid file, load failure, server error) return appropriate HTTP status (400, 422, 500) and a JSON body with a `detail` message.  
- **Carelum API** uses the same preprocessing and model as training; only the response format and thresholds are tailored to the contract.

---

## 11. End-to-End Flow Summary

| Stage            | What happens |
|------------------|--------------|
| **Data**         | Multiple datasets under `datasets/`; loader scans folders, normalises labels, builds DataFrame of (path, label). |
| **Preprocessing**| Load at 16 kHz mono, trim silence, normalise, fix length to 4 s. |
| **Features**     | Log-Mel spectrogram (128 bins), then (H, W, 1) for CNN. |
| **Balancing**    | Undersample to median count per class; oversample minorities with time stretch, pitch shift, noise. |
| **Split**        | 70% train, 15% val, 15% test, stratified. |
| **Model**        | CNN (3 Conv blocks + Dense + Dropout + Softmax); Adam, categorical cross-entropy; early stopping and LR reduction. |
| **Evaluation**    | Accuracy, precision, recall, F1, confusion matrix; plots in `evaluation/`. |
| **Inference**    | VAD (RMS) → if silence return normal/no_cry; else preprocess → Mel → CNN → if confidence low return no_cry/normal or uncertain; else return cry type. |
| **APIs**         | Same model and preprocessing; different response formats and ports (8002 generic, 8082 Carelum). |

---

## 12. Limitations and Possible Extensions

- **No “no cry” class in training**: The model always outputs one of the cry labels; rejection of non-cry is done only by VAD and confidence at inference.  
- **Datasets**: Bias and quality depend on the source datasets; adding more diverse, high-quality labelled data could improve robustness.  
- **Augmentation**: Current set (time stretch, pitch shift, noise) could be extended (e.g. room reverb, more aggressive stretch) for even more variety.  
- **Model size**: The CNN is small for speed; deeper or wider architectures (or transfer learning) could be tried for higher accuracy at the cost of compute.  
- **Thresholds**: ENERGY_THRESHOLD and CONFIDENCE_THRESHOLD are tuned empirically; they can be adjusted per deployment (e.g. stricter for fewer false positives, looser for higher recall).

This document, together with the code and README, gives a complete picture of what the system does, why each component exists, and how it is implemented for research and deployment.
