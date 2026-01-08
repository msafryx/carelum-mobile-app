#!/bin/bash
# Start script for Carelum Backend API

# Activate virtual environment
source venv/bin/activate

# Load environment variables from .env
export $(cat .env | grep -v '^#' | xargs)

# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
