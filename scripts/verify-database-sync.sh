#!/bin/bash
# Database Sync Verification Script Wrapper
# Uses backend virtual environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python3"

# Check if virtual environment exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "❌ Backend virtual environment not found!"
    echo "   Expected: $VENV_PYTHON"
    echo ""
    echo "💡 Fix: Create virtual environment first:"
    echo "   cd backend"
    echo "   python3 -m venv venv"
    echo "   source venv/bin/activate"
    echo "   pip install -r requirements.txt"
    exit 1
fi

# Run the Python script using venv Python
"$VENV_PYTHON" "$SCRIPT_DIR/verify-database-sync-complete.py"
