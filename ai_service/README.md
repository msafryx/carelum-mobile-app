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
   uvicorn app:app --reload --host 0.0.0.0 --port 8001
  ```
   Use **port 8001** and **`--host 0.0.0.0`** so your phone can reach it. The service will be available at `http://localhost:8001`. Test the API at **[http://localhost:8000/docs](http://localhost:8000/docs)**.
   **When using with Carelum backend:** The main backend runs on port 8000, so run the AI service on a different port (e.g. 8001) and set `AI_SERVICE_URL=http://localhost:8001` in the backend `.env`.
   **Mobile app (Cry Detection):** The Carelum app’s “Start Recording” / monitoring sends audio to this service. (1) Start the AI service: `uvicorn app:app --port 8000`. (2) If the AI service runs on a different port, set `EXPO_PUBLIC_AI_SERVICE_URL=http://localhost:8001` in the app’s `.env`. (3) When testing on a physical device, use your computer’s LAN IP, e.g. `EXPO_PUBLIC_AI_SERVICE_URL=http://192.168.1.10:8000`.

## Using your own trained AI service

You can **replace** this service with your own locally trained model. The app only needs:

- **POST /predict** – multipart form field `file` (audio), JSON response: `{ "cry_type": "your_label", "confidence_score": 0.9, "reason_suggested": true }`.

See **[API_CONTRACT.md](./API_CONTRACT.md)** for the full request/response contract. Implement that, run your server (e.g. on port 8001), set `EXPO_PUBLIC_AI_SERVICE_URL` in the app `.env`, and the app will use your service and display your labels (e.g. “Crying (Hungry)”, “Crying (Colic)”).

## API

- **GET /health** – Health check.
- **POST /classify** – Upload an audio file (multipart), get back `{ "prediction": "hungry", "class": "hungry" }`.
- **POST /predict** – `multipart/form-data` with field **file** (WAV audio). Returns `{ "cry_type": "hungry" }`.

Example (predict):

```bash
curl -X POST http://localhost:8001/predict -F "file=@sample.wav"
```

### "No AI result" / "Clip sent; AI did not respond"

If clips appear in the **session-audio** bucket but the app shows "No AI result":

1. **Start the AI service so it’s reachable from the phone:**
   ```bash
   cd ai_service && uvicorn app:app --host 0.0.0.0 --port 8001
   ```
   You should see: `Uvicorn running on http://0.0.0.0:8001`

2. **Check from your computer:**  
   `curl http://192.168.1.5:8001/health` (use your machine’s LAN IP). Should return `{"status":"ok",...}`.

3. **Check from the phone:** On the same Wi‑Fi, open in the phone browser: `http://192.168.1.5:8001/health`. If it doesn’t load, the phone can’t reach the AI service (firewall or wrong IP).

4. **App `.env`:** `EXPO_PUBLIC_AI_SERVICE_URL=http://192.168.1.5:8001` (same IP as in step 2). Then restart Expo with cache clear: `npx expo start -c`.

Example (classify):

```bash
curl -X POST http://localhost:8000/classify -F "audio=@sample.wav"
```

## Files


| File                       | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `app.py`                   | FastAPI app: load model, extract features, classify.                          |
| `requirements.txt`         | Python dependencies (joblib, librosa, scikit-learn, numpy, fastapi, etc.).    |
| `model.joblib`             | Pre-trained classifier (download via `download_models.py`).                   |
| `label.joblib`             | Label encoder (download via `download_models.py`).                            |
| `download_models.py`       | Fetches `model.joblib` and `label.joblib` from Hugging Face.                  |
| `realtime_cry_detector.py` | Test script: records 3s microphone windows, runs classifier, prints cry type. |


### Realtime microphone test

Requires `sounddevice` (in `requirements.txt`). Run:

```bash
python realtime_cry_detector.py
```

Then speak or play baby cry audio; every 3 seconds it prints the predicted cry type. Stop with Ctrl+C.