#!/bin/bash
# Comprehensive Database Operations Test
# Tests all database tables and user registration sync

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python3"

echo "=========================================="
echo "  COMPREHENSIVE DATABASE TESTING"
echo "=========================================="
echo ""

# Check if virtual environment exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "❌ Backend virtual environment not found!"
    echo "   Expected: $VENV_PYTHON"
    exit 1
fi

# Test 1: Database Sync Verification
echo "📋 Test 1: Database Sync Verification"
echo "----------------------------------------"
"$VENV_PYTHON" "$SCRIPT_DIR/verify-database-sync-complete.py"
SYNC_RESULT=$?

echo ""
echo ""

# Test 2: User Registration Sync Test
echo "📋 Test 2: User Registration Sync Test"
echo "----------------------------------------"
"$VENV_PYTHON" "$SCRIPT_DIR/test-user-registration.py"
REGISTRATION_RESULT=$?

echo ""
echo ""

# Summary
echo "=========================================="
echo "  TEST SUMMARY"
echo "=========================================="
echo ""

if [ $SYNC_RESULT -eq 0 ]; then
    echo "✅ Database Sync: PASSED"
else
    echo "❌ Database Sync: FAILED"
fi

if [ $REGISTRATION_RESULT -eq 0 ]; then
    echo "✅ User Registration Sync: PASSED"
else
    echo "❌ User Registration Sync: FAILED"
    echo ""
    echo "💡 Fix: Run scripts/fix-auth-users-sync.sql in Supabase SQL Editor"
fi

echo ""

if [ $SYNC_RESULT -eq 0 ] && [ $REGISTRATION_RESULT -eq 0 ]; then
    echo "✅ ALL TESTS PASSED!"
    exit 0
else
    echo "❌ SOME TESTS FAILED"
    exit 1
fi
