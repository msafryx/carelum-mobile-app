#!/bin/bash

# Test script for Carelum API endpoints
# Usage: ./test_endpoints.sh [TOKEN]
# If TOKEN is not provided, tests will check endpoint structure only

API_URL="${API_URL:-http://localhost:8000}"
TOKEN="${1:-}"

echo "🧪 Testing Carelum API Endpoints"
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -n "Testing $method $endpoint ... "
    
    if [ -z "$TOKEN" ]; then
        echo -e "${YELLOW}SKIPPED (no token)${NC}"
        return
    fi
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $TOKEN" \
            "$API_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ OK (${http_code})${NC}"
    elif [ "$http_code" -eq 401 ]; then
        echo -e "${YELLOW}⚠ UNAUTHORIZED (${http_code})${NC}"
    elif [ "$http_code" -eq 403 ]; then
        echo -e "${YELLOW}⚠ FORBIDDEN (${http_code})${NC}"
    elif [ "$http_code" -eq 404 ]; then
        echo -e "${YELLOW}⚠ NOT FOUND (${http_code})${NC}"
    else
        echo -e "${RED}✗ ERROR (${http_code})${NC}"
        echo "   Response: $body" | head -c 100
    fi
}

# Health check (no auth required)
echo "=== Health Check ==="
test_endpoint "GET" "/health" "" "Health check"

# User endpoints
echo ""
echo "=== User Endpoints ==="
test_endpoint "GET" "/api/users/me" "" "Get current user profile"

# Session endpoints
echo ""
echo "=== Session Endpoints ==="
test_endpoint "GET" "/api/sessions" "" "Get user sessions"
test_endpoint "GET" "/api/sessions?status=active" "" "Get active sessions"

# Children endpoints
echo ""
echo "=== Children Endpoints ==="
test_endpoint "GET" "/api/children" "" "Get user children"

# Alert endpoints
echo ""
echo "=== Alert Endpoints ==="
test_endpoint "GET" "/api/alerts" "" "Get user alerts"
test_endpoint "GET" "/api/alerts?status=new" "" "Get new alerts"

# GPS endpoints
echo ""
echo "=== GPS Endpoints ==="
echo "Note: GPS endpoints require active session - skipping detailed tests"

# Message endpoints
echo ""
echo "=== Message Endpoints ==="
echo "Note: Message endpoints require session ID - skipping detailed tests"

echo ""
echo "✅ Basic endpoint structure tests completed"
echo ""
echo "To test with authentication:"
echo "  1. Get a token from Supabase Auth"
echo "  2. Run: TOKEN=your_token ./test_endpoints.sh"
echo "  3. Or: ./test_endpoints.sh your_token"
