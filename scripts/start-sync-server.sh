#!/bin/bash

# Start Sync Server with Password Support
# Run: bash scripts/start-sync-server.sh
# Or: bash scripts/start-sync-server.sh your_password

echo "🚀 Starting Carelum Sync Server..."
echo ""

# Get password from argument or environment
if [ -z "$1" ]; then
    if [ -z "$DB_PASSWORD" ]; then
        echo "Enter MySQL root password (or press Enter if no password):"
        read -s MYSQL_PASSWORD
        if [ ! -z "$MYSQL_PASSWORD" ]; then
            export DB_PASSWORD="$MYSQL_PASSWORD"
        fi
    else
        echo "Using DB_PASSWORD from environment"
    fi
else
    export DB_PASSWORD="$1"
fi

# Check if node_modules exists
if [ ! -d "scripts/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd scripts
    npm install
    cd ..
fi

# Start server
echo ""
echo "🚀 Starting sync server..."
echo "   Server will run on http://localhost:3001"
echo "   Press Ctrl+C to stop"
echo ""

cd scripts
if [ -z "$DB_PASSWORD" ]; then
    node db-sync-server.js
else
    DB_PASSWORD="$DB_PASSWORD" node db-sync-server.js
fi
