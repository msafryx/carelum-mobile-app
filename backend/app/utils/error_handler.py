"""
Backend error handling utilities
"""
from fastapi import HTTPException
from typing import Optional

class AppError(Exception):
    """Custom application error"""
    def __init__(self, code: str, message: str, status_code: int = 500):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

def handle_error(error: Exception, default_message: str = "An error occurred") -> HTTPException:
    """Convert exceptions to HTTP exceptions"""
    if isinstance(error, AppError):
        return HTTPException(
            status_code=error.status_code,
            detail={
                "success": False,
                "error": {
                    "code": error.code,
                    "message": error.message
                }
            }
        )
    
    # Log the actual error for debugging
    import traceback
    error_details = traceback.format_exc()
    print(f"❌ Unhandled error: {type(error).__name__}: {str(error)}")
    print(f"❌ Traceback:\n{error_details}")
    
    return HTTPException(
        status_code=500,
        detail={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": f"{default_message}: {str(error)}"
            }
        }
    )
