# Baby Cry Classification AI Service

Microservice that classifies baby cry audio using the [foduucom/baby-cry-classification](https://huggingface.co/foduucom/baby-cry-classification) model.

**Predictions:** `belly pain` | `burping` | `discomfort` | `hungry` | `tired`

## Setup

1. Create a virtual environment and install dependencies:

   ```bash
   cd ai_service
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Download the model files (creates `model.joblib` and `label.joblib`):

   ```bash
   python download_models.py
   ```

3. Run the AI server (STEP 6):

   ```bash
   uvicorn app:app --reload --port 8000
   ```

   The service will be available at `http://localhost:8000`. Test the API at **http://localhost:8000/docs**.

   **When using with Carelum backend:** The main backend runs on port 8000, so run the AI service on a different port (e.g. 8001) and set `AI_SERVICE_URL=http://localhost:8001` in the backend `.env`.

## API

- **GET /health** – Health check.
- **POST /classify** – Upload an audio file (multipart), get back `{ "prediction": "hungry", "class": "hungry" }`.
- **POST /predict** – `multipart/form-data` with field **file** (WAV audio). Returns `{ "cry_type": "hungry" }`.

Example (predict):

```bash
curl -X POST http://localhost:8000/predict -F "file=@sample.wav"
```

Example (classify):

```bash
curl -X POST http://localhost:8000/classify -F "audio=@sample.wav"
```

## Files

| File               | Description |
|--------------------|-------------|
| `app.py`           | FastAPI app: load model, extract features, classify. |
| `requirements.txt` | Python dependencies (joblib, librosa, scikit-learn, numpy, fastapi, etc.). |
| `model.joblib`     | Pre-trained classifier (download via `download_models.py`). |
| `label.joblib`     | Label encoder (download via `download_models.py`). |
| `download_models.py` | Fetches `model.joblib` and `label.joblib` from Hugging Face. |
| `realtime_cry_detector.py` | Test script: records 3s microphone windows, runs classifier, prints cry type. |

### Realtime microphone test

Requires `sounddevice` (in `requirements.txt`). Run:

```bash
python realtime_cry_detector.py
```

Then speak or play baby cry audio; every 3 seconds it prints the predicted cry type. Stop with Ctrl+C.
