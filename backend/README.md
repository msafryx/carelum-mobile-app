# Carelum Backend API

FastAPI backend service for AI features (cry detection and chatbot).

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure Firebase Admin SDK:
   - Download service account key from Firebase Console
   - Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
   - Or place `serviceAccountKey.json` in the backend directory

3. Run the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

### Health Check
- `GET /health` - Check API health

### Cry Detection
- `POST /predict` - Predict if audio contains crying (placeholder)

### Chatbot
- `POST /bot/update` - Update child care instructions (placeholder)
- `POST /bot/ask` - Ask chatbot a question (placeholder)

## Development Notes

- All endpoints are currently placeholders
- MFCC extraction and CRNN model integration will be added after model training
- Chatbot RAG and LLM integration will be implemented later
- Firebase Admin SDK integration for Firestore access is pending

## Environment Variables

- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Firebase service account key
- `API_URL` - Base URL for the API (default: http://localhost:8000)
