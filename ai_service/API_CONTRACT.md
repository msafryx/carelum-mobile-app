# Cry detection – API contract for the Carelum app

The app calls **one endpoint** for cry detection. Any service that implements this contract can be used (current `ai_service` or your own locally trained service).

## Base URL

Set in the app `.env`:

- `EXPO_PUBLIC_AI_SERVICE_URL=http://YOUR_HOST:PORT`  
  Example: `http://192.168.1.5:8001` (for device on same Wi‑Fi).

The app sends requests to: `{EXPO_PUBLIC_AI_SERVICE_URL}/predict`

---

## Endpoint: `POST /predict`

### Request

- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Body:** one field named **`file`**
  - Value: audio file (binary)
  - Accepted formats: WAV, M4A, MP4, etc. (the app may send `.wav` or `.m4a`)

Example (curl):

```bash
curl -X POST http://localhost:8001/predict -F "file=@recording.wav"
```

### Response (JSON)

**Success (HTTP 200):**

| Field               | Type    | Required | Description |
|---------------------|---------|----------|-------------|
| `cry_type`         | string  | Yes      | Predicted class. Can be your own labels (e.g. `hungry`, `tired`, `colic`, `discomfort`, `burping`, `belly pain`, or `normal` / `no_cry` for no crying). |
| `confidence_score` | number  | No       | 0–1. If present and &lt; 0.5, the app will not show a specific reason (only “Crying”). |
| `reason_suggested` | boolean | No       | If `false`, the app shows “Crying” without a specific type. Default: `true`. |

**Examples:**

```json
{ "cry_type": "hungry", "confidence_score": 0.92, "reason_suggested": true }
```

```json
{ "cry_type": "normal" }
```

```json
{ "cry_type": "discomfort", "confidence_score": 0.45, "reason_suggested": false }
```

**Errors:** use normal HTTP status codes (400, 422, 500) and a JSON body (e.g. `{"detail": "..."}`).

---

## Optional: `GET /health`

- **Method:** `GET`
- **Path:** `/health`
- **Response (200):** e.g. `{"status": "ok"}`  

Used to check that the service is up. Not required for the app to work.

---

## How to use your own trained service

1. **Implement** `POST /predict` (and optionally `GET /health`) as above. You can use FastAPI, Flask, or any other framework.
2. **Run** your service (e.g. on port 8001):  
   `uvicorn your_app:app --host 0.0.0.0 --port 8001`
3. **Point the app** to it: in the project `.env` set  
   `EXPO_PUBLIC_AI_SERVICE_URL=http://YOUR_IP:8001`  
   (use your machine’s LAN IP when testing on a physical phone.)
4. No app code change is needed; the app will use whatever service is at that URL and will display your `cry_type` labels (e.g. “Crying (Hungry)”, “Crying (Colic)”).

You can either **replace** the contents of the `ai_service` folder with your own service (keeping the same `POST /predict` contract) or run your service in a **different folder/port** and only change `EXPO_PUBLIC_AI_SERVICE_URL`.
