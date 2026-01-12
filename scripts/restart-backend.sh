#!/bin/bash

# Script to properly restart the backend server
# Ensures .env is reloaded

echo "🔄 Restarting Backend Server..."
echo ""

# Check if server is running
if pgrep -f "uvicorn app.main:app" > /dev/null; then
    echo "⚠️  Backend server is currently running"
    echo "   Please stop it first (Ctrl+C in the terminal running uvicorn)"
    echo ""
    read -p "Press Enter after stopping the server, or Ctrl+C to cancel..."
fi

echo "✅ Starting backend server..."
echo ""

cd backend

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found"
    echo "   Create it with: python3 -m venv venv"
    exit 1
fi

source venv/bin/activate

# Verify .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found in backend/"
    exit 1
fi

# Check credentials
if ! grep -q "^SUPABASE_URL=" .env || ! grep -q "^SUPABASE_ANON_KEY=" .env; then
    echo "❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env"
    exit 1
fi

# Check key format
ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
if [[ $ANON_KEY == sb_publishable_* ]]; then
    echo "❌ ERROR: SUPABASE_ANON_KEY starts with 'sb_publishable_'"
    echo "   This is NOT a valid Supabase anon key!"
    echo "   Get the 'anon public' key from Supabase Dashboard → Settings → API"
    exit 1
fi

echo "✅ Environment variables verified"
echo ""

# Start server
echo "🚀 Starting uvicorn server..."
echo "   Watch for: '✅ Supabase client initialized'"
echo ""

python -m uvicorn app.main:app --reload --port 8000
