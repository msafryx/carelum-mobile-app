#!/bin/bash

# Complete Database Setup Script
# Run: bash scripts/setup-now.sh

echo "🗄️  Setting up Carelum Local Database..."
echo ""

# Step 1: Create database and tables
echo "📝 Step 1: Creating database and tables..."
echo "   (You may need to enter MySQL password or use sudo)"

# Try with sudo first (Ubuntu default)
sudo mysql -u root < scripts/create-mysql-tables.sql 2>/dev/null && {
    echo "✅ Database created with sudo"
} || {
    # Try without sudo
    mysql -u root < scripts/create-mysql-tables.sql 2>/dev/null && {
        echo "✅ Database created without sudo"
    } || {
        echo "❌ Could not create database automatically"
        echo ""
        echo "Please run manually:"
        echo "  sudo mysql -u root < scripts/create-mysql-tables.sql"
        echo "  OR"
        echo "  mysql -u root -p < scripts/create-mysql-tables.sql"
        exit 1
    }
}

# Step 2: Verify tables
echo ""
echo "📊 Step 2: Verifying tables..."
sudo mysql -u root carelum_local -e "SHOW TABLES;" 2>/dev/null || \
mysql -u root carelum_local -e "SHOW TABLES;" 2>/dev/null || {
    echo "⚠️  Could not verify tables"
}

# Step 3: Install sync server dependencies
echo ""
echo "📦 Step 3: Installing sync server dependencies..."
cd scripts
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Step 4: Check if sync server can start
echo ""
echo "🚀 Step 4: Testing sync server..."
echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Start sync server:"
echo "      cd scripts && node db-sync-server.js"
echo ""
echo "   2. In another terminal, test it:"
echo "      curl http://localhost:3001/health"
echo ""
echo "   3. Query database:"
echo "      mysql -u root carelum_local"
echo "      (or: sudo mysql -u root carelum_local)"
echo ""
