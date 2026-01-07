#!/bin/bash

# Setup Local Database for Carelum
# This script installs MySQL and sets up the database

echo "🗄️  Setting up local database for Carelum..."
echo ""

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "📦 MySQL not found. Installing..."
    
    # Detect OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update
        sudo apt-get install -y mysql-server
        sudo systemctl start mysql
        sudo systemctl enable mysql
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if ! command -v brew &> /dev/null; then
            echo "❌ Homebrew not found. Please install Homebrew first: https://brew.sh"
            exit 1
        fi
        brew install mysql
        brew services start mysql
    else
        echo "❌ Unsupported OS. Please install MySQL manually."
        exit 1
    fi
else
    echo "✅ MySQL is already installed"
fi

# Check if MySQL is running
if ! pgrep -x "mysqld" > /dev/null; then
    echo "🚀 Starting MySQL..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start mysql
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start mysql
    fi
    sleep 2
fi

# Create database
echo "📝 Creating database..."
mysql -u root -e "CREATE DATABASE IF NOT EXISTS carelum_local;" 2>/dev/null || {
    echo "⚠️  Could not create database. You may need to set MySQL root password."
    echo "   Run: mysql -u root -p"
    echo "   Then: CREATE DATABASE carelum_local;"
    exit 1
}

# Create tables
echo "📋 Creating tables..."
mysql -u root carelum_local < scripts/create-mysql-tables.sql 2>/dev/null || {
    echo "⚠️  Could not create tables. Please run manually:"
    echo "   mysql -u root -p carelum_local < scripts/create-mysql-tables.sql"
    exit 1
}

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📊 Next steps:"
echo "   1. Install sync server dependencies: cd scripts && npm install"
echo "   2. Start sync server: node scripts/db-sync-server.js"
echo "   3. In your app, call syncToLocalDB() to sync data"
echo "   4. Query database: mysql -u root -p carelum_local"
echo ""
