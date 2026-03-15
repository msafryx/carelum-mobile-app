# Baby Cry Classification AI

A production-ready **baby cry classification** system that identifies the reason behind an infant's cry (e.g. hungry, tired, discomfort) using a CNN trained on Mel spectrograms. The project includes training, local inference, microphone input, and REST APIs for mobile integration.

---

## Features

- **Multi-dataset training** — Combines Baby Cry Sense, Donate-a-Cry, and Infant Cry Corpus with unified labels
- **CNN on Mel spectrograms** — Lightweight, accurate classifier (TensorFlow/Keras)
- **Class balancing** — Undersampling + audio augmentation (time stretch, pitch shift, noise) for imbalanced data
- **False-detection control** — Sound activity detection (VAD) and confidence thresholds to avoid labelling silence or background noise as a cry type
- **Multiple interfaces** — Local script, microphone mode, generic API, and Carelum contract API

---

## Project Structure

```
baby-cry-ai/
├── README.md
├── RESEARCH.md                 # Full research/methodology explanation
├── requirements.txt
│
├── train_baby_cry_model.py     # Full training pipeline
├── test_model.py               # Local inference from WAV file
├── listen_and_predict.py       # Record from microphone and classify
├── api_server.py               # Generic FastAPI (port 8002)
├── carelum_cry_api.py          # Carelum mobile app contract API (port 8082)
│
├── model/
│   ├── baby_cry_cnn_model.h5   # Trained CNN (after training)
│   └── label_encoder.pkl       # Class labels (after training)
│
├── utils/
│   ├── data_loader.py          # Dataset loading, unified labels
│   ├── audio_preprocessing.py  # Load, trim, normalize, 4s fixed length
│   ├── feature_extraction.py   # Mel spectrogram, MFCC, etc.
│   ├── audio_augmentation.py   # Time stretch, pitch shift, noise
│   └── prediction.py           # VAD + confidence threshold logic
│
├── datasets/                   # Place datasets here
│   ├── Baby Cry Sense Dataset/
│   ├── donate-a-cry/
│   └── Infant Cry Corpus/
│
├── evaluation/                 # After training
│   ├── training_curve.png
│   └── confusion_matrix.png
│
└── API.md                      # API and curl/mobile usage
```

---

## Setup

### 1. Python environment

Use a virtual environment (recommended on Linux):

```bash
cd baby-cry-ai
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Datasets

Place your datasets under `datasets/` with one folder per source and subfolders per class:

- **Baby Cry Sense Dataset** — e.g. `belly pain/`, `hungry/`, `tired/`, …
- **donate-a-cry** — e.g. `belly_pain/`, `hungry/`, …
- **Infant Cry Corpus** — e.g. `belly_pain/`, `hungry/`, …

Class names are normalised automatically (e.g. `belly pain` → `belly_pain`). See `utils/data_loader.py` for the full label mapping.

---

## Training

Train the CNN and save model + label encoder:

```bash
python train_baby_cry_model.py
```

- Loads all `.wav` files from `datasets/`
- Balances classes (undersample + augmentation)
- 70% train / 15% val / 15% test (stratified)
- Saves `model/baby_cry_cnn_model.h5` and `model/label_encoder.pkl`
- Writes `evaluation/training_curve.png` and `evaluation/confusion_matrix.png`

---

## Inference

### Local (WAV file)

```bash
python test_model.py path/to/audio.wav
# or use a dataset sample if sample.wav is missing:
python test_model.py sample.wav
```

Output (stdout): `{"cry_type": "hungry", "confidence": 0.82}` or `{"cry_type": "no_cry", "confidence": 0.0}` when silence/low confidence.

### Microphone

```bash
python listen_and_predict.py
# Press Enter → records 4 s → prints cry type and confidence
python listen_and_predict.py --loop   # Keep recording every 3 s until Ctrl+C
```

Uses the same VAD and confidence logic as the APIs (silence → `no_cry`).

---

## APIs

### Generic API (port 8002)

For custom clients and testing:

```bash
uvicorn api_server:app --host 0.0.0.0 --port 8002
```

- **GET /** — `{"status": "Baby Cry AI API running"}`
- **POST /predict** — `multipart/form-data`, field `file` (WAV)  
  Response: `{"cry_type": "hungry" | "no_cry", "confidence": 0.82}`

### Carelum mobile app API (port 8082)

Contract for the Carelum app:

```bash
uvicorn carelum_cry_api:app --host 0.0.0.0 --port 8082
```

- **GET /health** — `{"status": "ok"}`
- **POST /predict** — `multipart/form-data`, field `file` (wav/m4a/mp4)

Response format:

- Silence: `{"cry_type": "normal", "confidence_score": 0, "reason_suggested": false}`
- Low confidence: `{"cry_type": "<label>", "confidence_score": 0.3, "reason_suggested": false}`
- Confident cry: `{"cry_type": "hungry", "confidence_score": 0.87, "reason_suggested": true}`

**Test with curl:**

```bash
curl -X POST http://localhost:8082/predict -F "file=@recording.wav"
```

**Mobile:** set `EXPO_PUBLIC_AI_SERVICE_URL=http://SERVER_IP:8082` and POST audio to `/predict`.

---

## Configuration

| Component        | File / location        | What to tune |
|-----------------|------------------------|---------------|
| VAD / confidence| `utils/prediction.py`   | `ENERGY_THRESHOLD`, `CONFIDENCE_THRESHOLD` |
| Carelum API     | `carelum_cry_api.py`    | `ENERGY_THRESHOLD`, `CONFIDENCE_THRESHOLD` |
| Training        | `train_baby_cry_model.py` | `EPOCHS`, `BATCH_SIZE`, split ratios |

---

## Requirements

See `requirements.txt`. Main dependencies:

- Python ≥ 3.10
- TensorFlow ≥ 2.14
- librosa, numpy, pandas, scikit-learn
- FastAPI, uvicorn, python-multipart (APIs)
- sounddevice (microphone script)

---

## Documentation

- **README.md** (this file) — Setup, usage, and project layout
- **RESEARCH.md** — Research narrative: what was done, why, and how (datasets, preprocessing, model, evaluation, inference)
- **API.md** — API usage, curl examples, and mobile integration notes

---

## License

Use and adapt as needed for the Carelum project.
