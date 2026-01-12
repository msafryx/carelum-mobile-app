#!/bin/bash

# Helper script to fix backend .env file
# This script helps you update the SUPABASE_ANON_KEY

echo "🔧 Backend .env Fix Helper"
echo "=========================="
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env file not found"
    echo "Creating new .env file..."
    touch backend/.env
fi

echo "Current SUPABASE_ANON_KEY in backend/.env:"
echo "-------------------------------------------"
if grep -q "^SUPABASE_ANON_KEY=" backend/.env; then
    CURRENT_KEY=$(grep "^SUPABASE_ANON_KEY=" backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    echo "Current: ${CURRENT_KEY:0:50}..."
    
    if [[ $CURRENT_KEY == sb_publishable_* ]]; then
        echo ""
        echo "⚠️  PROBLEM DETECTED: Key starts with 'sb_publishable_'"
        echo "   This is NOT a valid Supabase anon key!"
        echo ""
        echo "✅ SOLUTION:"
        echo "   1. Go to Supabase Dashboard → Settings → API"
        echo "   2. Find 'anon public' key (NOT 'publishable' key)"
        echo "   3. Copy the entire key (it's very long, 100+ characters)"
        echo "   4. Run this command to update:"
        echo ""
        echo "   nano backend/.env"
        echo ""
        echo "   5. Find the line: SUPABASE_ANON_KEY=..."
        echo "   6. Replace with: SUPABASE_ANON_KEY=your_correct_key_here"
        echo ""
    else
        echo "✅ Key format looks correct"
    fi
else
    echo "❌ SUPABASE_ANON_KEY not found in backend/.env"
    echo ""
    echo "Add this line to backend/.env:"
    echo "SUPABASE_ANON_KEY=your_anon_key_from_supabase_dashboard"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Quick Reference"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your backend/.env should have:"
echo ""
echo "SUPABASE_URL=https://ojllcxqnxwyksucvojym.supabase.co"
echo "SUPABASE_ANON_KEY=<very_long_base64_string_from_supabase_dashboard>"
echo "SUPABASE_JWT_SECRET=<jwt_secret_from_supabase_dashboard>"
echo ""
echo "The anon key should:"
echo "  ✓ Be 100+ characters long"
echo "  ✓ Look like base64 (usually starts with 'eyJ...')"
echo "  ✗ NOT start with 'sb_publishable_'"
echo ""
