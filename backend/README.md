# Carelum Backend API

FastAPI backend service providing REST API for user management, admin operations, and AI features (cry detection and chatbot).

## 🚀 Quick Start

### Setup

1. **Create virtual environment** (if not already created):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Configure environment variables**:
   Create a `.env` file in the `backend/` directory:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_JWT_SECRET=your_jwt_secret  # Optional
   ```

4. **Run the server**:
```bash
./start.sh
# OR
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📚 Documentation

- **[API_GUIDE.md](./API_GUIDE.md)** - Complete API documentation with setup, testing, and usage
- **[README_SETUP.md](./README_SETUP.md)** - Detailed setup and troubleshooting guide

## 🔌 API Endpoints

### User Endpoints
- `GET /api/users/me` - Get current user profile (requires auth)
- `PUT /api/users/me` - Update current user profile (requires auth)

### Admin Endpoints
- `GET /api/admin/users` - Get all users (requires admin, supports role filtering)
- `GET /api/admin/users/{user_id}` - Get user by ID (requires admin)
- `PUT /api/admin/users/{user_id}` - Update user (requires admin)
- `DELETE /api/admin/users/{user_id}` - Delete user (requires admin)
- `GET /api/admin/stats` - Get admin statistics (requires admin)

### AI Endpoints
- `POST /predict` - Predict if audio contains crying sounds
- `POST /bot/update` - Update child care instructions
- `POST /bot/ask` - Ask chatbot a question

### Health Check
- `GET /health` - Check API health

## 🔐 Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <supabase_jwt_token>
```

The token is obtained from Supabase Auth and validated by the backend. Admin endpoints additionally require the user to have `role: "admin"`.

## 🏗️ Architecture

### Key Components

- **Authentication Middleware** (`app/utils/auth.py`) - JWT token validation
- **User Routes** (`app/routes/users.py`) - User/profile operations
- **Admin Routes** (`app/routes/admin.py`) - Admin operations
- **Database Utilities** (`app/utils/database.py`) - Supabase client management
- **Error Handling** (`app/utils/error_handler.py`) - Consistent error responses

### Tech Stack

- **FastAPI** - Modern Python web framework
- **Supabase** - Database and authentication
- **Pydantic** - Data validation
- **Uvicorn** - ASGI server

## 🧪 Testing

### Health Check
```bash
curl http://localhost:8000/health
```

### Test User Endpoint (requires token)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/users/me
```

### Interactive Testing
Visit http://localhost:8000/docs for Swagger UI with "Try it out" functionality.

## 📝 Environment Variables

- `SUPABASE_URL` - Your Supabase project URL (required)
- `SUPABASE_ANON_KEY` - Your Supabase anon key (required)
- `SUPABASE_JWT_SECRET` - JWT secret for manual verification (optional)

## 🔄 Development Notes

### Adding New Endpoints

1. Create route file in `app/routes/`
2. Define router and endpoints with authentication
3. Register router in `app/main.py`
4. Server auto-reloads (if using `--reload`)

### AI Features Status

- Cry detection endpoint is a placeholder (MFCC extraction and CRNN model integration pending)
- Chatbot endpoints are placeholders (RAG and LLM integration pending)

## 🐛 Troubleshooting

See [README_SETUP.md](./README_SETUP.md) for common issues and solutions.

Common issues:
- **Module not found**: Activate virtual environment
- **Supabase credentials not found**: Check `.env` file
- **Port already in use**: Use different port with `--port` flag
