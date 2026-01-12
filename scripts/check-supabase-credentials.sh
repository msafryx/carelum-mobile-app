#!/bin/bash

# Script to check Supabase credentials format
# Helps identify if credentials are correctly formatted

echo "🔍 Checking Supabase Credentials Format..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ backend/.env file not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ backend/.env file found${NC}"
echo ""

# Check for SUPABASE_URL
if grep -q "^SUPABASE_URL=" backend/.env; then
    SUPABASE_URL=$(grep "^SUPABASE_URL=" backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    echo -e "${GREEN}✅ SUPABASE_URL is set${NC}"
    
    # Validate URL format
    if [[ $SUPABASE_URL == https://*.supabase.co ]]; then
        echo -e "${GREEN}   ✓ URL format looks correct${NC}"
    else
        echo -e "${YELLOW}   ⚠ URL format might be incorrect (should be https://*.supabase.co)${NC}"
    fi
    echo "   Value: ${SUPABASE_URL:0:50}..."
else
    echo -e "${RED}❌ SUPABASE_URL not found${NC}"
    echo "   Add: SUPABASE_URL=https://your-project.supabase.co"
fi

echo ""

# Check for SUPABASE_ANON_KEY
if grep -q "^SUPABASE_ANON_KEY=" backend/.env; then
    SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    echo -e "${GREEN}✅ SUPABASE_ANON_KEY is set${NC}"
    
    # Check key format
    KEY_LENGTH=${#SUPABASE_ANON_KEY}
    if [[ $SUPABASE_ANON_KEY == sb_publishable_* ]]; then
        echo -e "${RED}   ✗ Key starts with 'sb_publishable_' - This is WRONG!${NC}"
        echo -e "${YELLOW}   ⚠ This looks like a publishable key, not an anon key${NC}"
        echo "   Get the 'anon public' key from Supabase Dashboard → Settings → API"
    elif [[ $SUPABASE_ANON_KEY == eyJ* ]]; then
        echo -e "${GREEN}   ✓ Key format looks correct (JWT format)${NC}"
    elif [ $KEY_LENGTH -gt 50 ]; then
        echo -e "${GREEN}   ✓ Key length looks reasonable (${KEY_LENGTH} chars)${NC}"
    else
        echo -e "${YELLOW}   ⚠ Key seems short (${KEY_LENGTH} chars) - might be incorrect${NC}"
    fi
    echo "   Key preview: ${SUPABASE_ANON_KEY:0:30}..."
else
    echo -e "${RED}❌ SUPABASE_ANON_KEY not found${NC}"
    echo "   Add: SUPABASE_ANON_KEY=your_anon_key_here"
fi

echo ""

# Check for EXPO_PUBLIC variables (frontend)
if grep -q "^EXPO_PUBLIC_SUPABASE" backend/.env; then
    echo -e "${YELLOW}ℹ️  Frontend variables (EXPO_PUBLIC_*) found${NC}"
    echo "   These are for frontend, backend needs SUPABASE_* variables"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To fix:"
echo "1. Get credentials from Supabase Dashboard → Settings → API"
echo "2. Add to backend/.env:"
echo "   SUPABASE_URL=https://your-project.supabase.co"
echo "   SUPABASE_ANON_KEY=your_anon_public_key"
echo ""
echo "The anon key should:"
echo "  ✓ Be a long base64 string"
echo "  ✓ Usually starts with 'eyJ...' (JWT format)"
echo "  ✗ NOT start with 'sb_publishable_'"
echo ""
