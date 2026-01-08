# Backend Setup Guide

## Quick Start

### 1. Virtual Environment (Already Created)
The virtual environment is already set up in `venv/`. To activate it:

```bash
cd backend
source venv/bin/activate
```

### 2. Environment Variables
Make sure your `.env` file is in the `backend/` directory with:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Start the Server

**Option 1: Using the startup script**
```bash
./start.sh
```

**Option 2: Manual start**
```bash
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Verify Setup

1. Check health endpoint:
```bash
curl http://localhost:8000/health
```

2. Check if Supabase is initialized:
   - Look for "✅ Supabase client initialized" in the startup logs
   - If you see "⚠️ Supabase credentials not found", check your `.env` file

## API Endpoints

- `GET /api/users/me` - Get current user profile (requires auth)
- `PUT /api/users/me` - Update current user profile (requires auth)
- `GET /api/admin/users` - Get all users (requires admin)
- `GET /api/admin/stats` - Get admin statistics (requires admin)

See `API_GUIDE.md` for full documentation.

## Troubleshooting

### "Module not found" errors
Make sure the virtual environment is activated:
```bash
source venv/bin/activate
```

### "Supabase credentials not found"
1. Check that `.env` file exists in `backend/` directory
2. Verify the file contains `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Make sure there are no extra spaces or quotes around the values

### Port already in use
Change the port:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```
