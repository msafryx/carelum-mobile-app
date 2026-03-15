# Baby Cry AI — API & Integration

## Running the API server

From the project root (with venv activated):

```bash
# Development (auto-reload on code changes)
uvicorn api_server:app --reload

# Production (bind to all interfaces, port 8002)
uvicorn api_server:app --host 0.0.0.0 --port 8002
```

- **Health check:** http://localhost:8002/
- **Interactive docs:** http://localhost:8002/docs

---

## Test with curl

Upload a WAV file and get prediction:

```bash
curl -X POST \
  -F "file=@test_audio.wav" \
  http://localhost:8002/predict
```

Example response:

```json
{
  "cry_type": "hungry",
  "confidence": 0.81
}
```

---

## Mobile app integration

**Flow:**

1. Mobile app records baby cry audio (e.g. as `.wav` or convert to WAV before upload).
2. App uploads the audio to the API: **POST** `/predict` with `multipart/form-data`, field name **`file`**, content type WAV.
3. API returns JSON: `cry_type` (string) and `confidence` (float 0–1).
4. App displays the result (e.g. “Likely: Hungry (78% confidence)”).

**Example response used by the app:**

```json
{
  "cry_type": "hungry",
  "confidence": 0.78
}
```

**Android (Kotlin) example (concept):**

- Use `OkHttp` or `Retrofit` with `MultipartBody.Part` for the audio file.
- POST to `https://your-server.com/predict` with body part name `file`.

**iOS (Swift) example (concept):**

- Build `multipart/form-data` with the audio file and field name `file`.
- POST to `https://your-server.com/predict` using `URLSession` or Alamofire.

**Error responses (JSON):**

- `400`: Missing file, wrong field name, or non-WAV file.
- `422`: Audio invalid or feature extraction failed (e.g. corrupted or empty WAV).
- `500`: Server/model error.
- `503`: Model not loaded (e.g. right after startup).

All errors include an `error` and `message` (and optionally `detail`) for debugging.

---

## Local test (no server)

Test the model on a single file without starting the API:

```bash
python test_model.py sample.wav
```

Output:

```json
{
  "cry_type": "hungry",
  "confidence": 0.82
}
```
