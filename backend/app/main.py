"""
FastAPI application for Carelum AI services
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from app.routes import predict, bot, users, admin

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase client
from app.utils.database import init_supabase, get_supabase

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        init_supabase(SUPABASE_URL, SUPABASE_ANON_KEY)
        logger.info("✅ Supabase client initialized")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize Supabase client: {e}")
else:
    logger.warning("⚠️ Supabase credentials not found. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.")

# Export supabase for backward compatibility
supabase = get_supabase()

# Initialize FastAPI app
app = FastAPI(
    title="Carelum API",
    description="API for Carelum childcare platform - AI services, user management, and admin operations",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred"
            }
        }
    )

# Include routers
app.include_router(predict.router, prefix="/predict", tags=["prediction"])
app.include_router(bot.router, prefix="/bot", tags=["bot"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "carelum-api"}

@app.get("/")
async def root():
    return {
        "message": "Carelum API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "ai": {
                "predict": "/predict",
                "bot": "/bot"
            },
            "users": {
                "profile": "/api/users/me"
            },
            "admin": {
                "users": "/api/admin/users",
                "stats": "/api/admin/stats"
            }
        }
    }
