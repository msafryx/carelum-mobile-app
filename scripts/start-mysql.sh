#!/bin/bash

# Start MySQL and Setup Database
# Run: bash scripts/start-mysql.sh

echo "🚀 Starting MySQL service..."

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL is not installed"
    echo "   Install with: sudo apt-get install mysql-server"
    exit 1
fi

# Start MySQL service
echo "📦 Starting MySQL..."
sudo systemctl start mysql

# Wait a moment
sleep 2

# Check status
if sudo systemctl is-active --quiet mysql; then
    echo "✅ MySQL is running"
else
    echo "❌ Failed to start MySQL"
    echo "   Try: sudo systemctl status mysql"
    exit 1
fi

# Enable MySQL to start on boot
echo "🔧 Enabling MySQL on boot..."
sudo systemctl enable mysql

# Test connection
echo "🔍 Testing connection..."
sudo mysql -e "SELECT 'MySQL is working!' AS status;" 2>/dev/null && {
    echo "✅ Connection successful!"
} || {
    echo "⚠️  Connection test failed, but service is running"
}

echo ""
echo "📋 Next steps:"
echo "   1. Create database: sudo mysql < scripts/create-mysql-tables.sql"
echo "   2. Or connect: sudo mysql"
echo ""
