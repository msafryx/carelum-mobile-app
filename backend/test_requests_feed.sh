#!/bin/bash

# Quick test script for Babysitter Requests Feed (API only).
# Full testing steps (UI + API) are in TESTING_GUIDE.md at project root.
# Usage: ./test_requests_feed.sh [SITTER_TOKEN]

API_URL="${API_URL:-http://localhost:8000}"
SITTER_TOKEN="${1:-}"

echo "🧪 Testing Babysitter Requests Feed"
echo "API URL: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$SITTER_TOKEN" ]; then
    echo -e "${YELLOW}⚠ No token provided${NC}"
    echo "Usage: ./test_requests_feed.sh YOUR_SITTER_JWT_TOKEN"
    echo ""
    echo "To get a token:"
    echo "  1. Login as sitter in the app"
    echo "  2. Get token from Supabase Auth or browser DevTools"
    exit 1
fi

echo -e "${BLUE}=== Test 1: Discover All Available Sessions ===${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer $SITTER_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_URL/api/sessions/discover/available")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ OK (${http_code})${NC}"
    count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "0")
    echo "   Found $count available sessions"
    
    # Show first session details
    if [ "$count" -gt 0 ]; then
        echo ""
        echo "   First session:"
        echo "$body" | jq '.[0] | {id, status, searchScope, childId, parentId, startTime, hourlyRate}' 2>/dev/null || echo "$body" | head -20
    fi
else
    echo -e "${RED}✗ ERROR (${http_code})${NC}"
    echo "   Response: $body" | head -10
fi

echo ""
echo -e "${BLUE}=== Test 2: Discover with City Filter ===${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer $SITTER_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_URL/api/sessions/discover/available?sitter_city=Colombo")

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ OK (${http_code})${NC}"
else
    echo -e "${RED}✗ ERROR (${http_code})${NC}"
fi

echo ""
echo -e "${BLUE}=== Test 3: Discover with Scope Filter (Nearby) ===${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer $SITTER_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_URL/api/sessions/discover/available?scope=nearby&max_distance=10")

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ OK (${http_code})${NC}"
else
    echo -e "${RED}✗ ERROR (${http_code})${NC}"
fi

echo ""
echo -e "${BLUE}=== Test 4: Discover with Scope Filter (City) ===${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer $SITTER_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_URL/api/sessions/discover/available?scope=city")

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ OK (${http_code})${NC}"
else
    echo -e "${RED}✗ ERROR (${http_code})${NC}"
fi

echo ""
echo -e "${BLUE}=== Test 5: Discover with Scope Filter (Nationwide) ===${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer $SITTER_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_URL/api/sessions/discover/available?scope=nationwide")

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ OK (${http_code})${NC}"
else
    echo -e "${RED}✗ ERROR (${http_code})${NC}"
fi

echo ""
echo -e "${BLUE}=== Test 6: Discover with Scope Filter (Invite) ===${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer $SITTER_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_URL/api/sessions/discover/available?scope=invite")

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ OK (${http_code})${NC}"
    count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "0")
    echo "   Found $count invite sessions"
else
    echo -e "${RED}✗ ERROR (${http_code})${NC}"
fi

echo ""
echo -e "${BLUE}=== Test 7: Invalid Scope (Should Fail) ===${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Authorization: Bearer $SITTER_TOKEN" \
    -H "Content-Type: application/json" \
    "$API_URL/api/sessions/discover/available?scope=invalid")

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" -eq 400 ]; then
    echo -e "${GREEN}✓ Correctly rejected invalid scope (${http_code})${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response (${http_code})${NC}"
fi

echo ""
echo -e "${BLUE}=== Test 8: Parent Access (Should Fail) ===${NC}"
echo -e "${YELLOW}Note: Use a parent token for this test${NC}"
echo "   This should return 403 Forbidden"

echo ""
echo -e "${GREEN}✅ Requests Feed API Tests Completed${NC}"
echo ""
echo "Next steps:"
echo "  1. Test in the app UI (login as sitter, go to Requests tab)"
echo "  2. Create test sessions with different scopes"
echo "  3. Verify real-time updates work"
echo "  4. Check request cards display correctly"
