# Connect baby-cry-ai to the Carelum app

Your trained model is in `model/` and the Carelum API is in `carelum_cry_api.py`. Follow these steps to use it with the mobile app.

## 1. Venv (fixed)

The virtualenv was recreated so `pip` works. Use the venv inside this folder:

```bash
cd baby-cry-ai
source venv/bin/activate   # or: venv\Scripts\activate on Windows
```

To reinstall dependencies later:

```bash
./venv/bin/pip install -r requirements.txt
```

## 2. Start the API (port 8001)

Run the Carelum contract API so the app can call it. Use **port 8001** so you don’t need to change the app’s `.env`:

```bash
cd baby-cry-ai
./venv/bin/uvicorn carelum_cry_api:app --host 0.0.0.0 --port 8001
```

You should see: `Model and label encoder loaded successfully.` and `Uvicorn running on http://0.0.0.0:8001`.

- **On device:** Use your computer’s LAN IP. In the app’s **frontend** `.env` set:
  `EXPO_PUBLIC_AI_SERVICE_URL=http://192.168.1.5:8001`  
  (replace with your machine’s IP). Port **8001** matches the command above.

## 3. Point the app to this service

The Carelum app uses `EXPO_PUBLIC_AI_SERVICE_URL` from the **frontend** `.env` (project root of the React Native app).

- If you run baby-cry-ai on **8001**, set:
  `EXPO_PUBLIC_AI_SERVICE_URL=http://YOUR_IP:8001`
- Reload the app (or `npx expo start -c`).

No app code changes are needed: the app already calls `POST /predict` and expects `cry_type`, `confidence_score`, and `reason_suggested`.

## 4. Test

From your computer:

```bash
curl http://localhost:8001/health
curl -X POST http://localhost:8001/predict -F "file=@path/to/audio.wav"
```

Then in the app: Start Recording and check that Detection History and Cry alerts use your model’s predictions.

## Troubleshooting

- **"Network request failed (POST http://192.168.1.5:8001/predict)":**  
  The app cannot reach the AI service. Do this:
  1. **Start the AI service** in a separate terminal (it is not started by the main backend’s `start.sh`):
     ```bash
     cd frontend/baby-cry-ai && ./start_carelum.sh
     ```
  2. On your computer, check: `curl http://192.168.1.5:8001/health` → should return `{"status":"ok"}`.
  3. On the phone (same Wi‑Fi), open in browser: `http://192.168.1.5:8001/health`. If it doesn’t load, the phone can’t reach the computer (check firewall for port 8001, or try another IP).
- **"Failed to connect" on device:** Start the API with `--host 0.0.0.0` and use your computer’s LAN IP in `EXPO_PUBLIC_AI_SERVICE_URL`. Open `http://YOUR_IP:8001/health` in the phone browser to confirm.
- **"Model not loaded":** Ensure `model/baby_cry_cnn_model.h5` and `model/label_encoder.pkl` exist (they are created by training or by copying your trained files).
