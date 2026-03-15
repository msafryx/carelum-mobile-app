#!/usr/bin/env bash
# Start the Carelum contract API on port 8001 (same as app .env).
cd "$(dirname "$0")"
exec ./venv/bin/uvicorn carelum_cry_api:app --host 0.0.0.0 --port 8001
