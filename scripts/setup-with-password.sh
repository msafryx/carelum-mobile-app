#!/bin/bash

# Setup Database with Password
# Run: bash scripts/setup-with-password.sh
# Or: bash scripts/setup-with-password.sh your_password

echo "🗄️  Setting up Carelum Local Database with password..."
echo ""

# Get password from argument or prompt
if [ -z "$1" ]; then
    echo "Enter MySQL root password (or press Enter if no password):"
    read -s MYSQL_PASSWORD
else
    MYSQL_PASSWORD="$1"
fi

# Create database and tables
echo ""
echo "📝 Creating database and tables..."

if [ -z "$MYSQL_PASSWORD" ]; then
    # No password
    mysql -u root < scripts/create-mysql-tables.sql 2>/dev/null && {
        echo "✅ Database created successfully!"
    } || {
        echo "❌ Failed. Try with sudo:"
        echo "   sudo mysql < scripts/create-mysql-tables.sql"
        exit 1
    }
else
    # With password
    mysql -u root -p"$MYSQL_PASSWORD" < scripts/create-mysql-tables.sql 2>/dev/null && {
        echo "✅ Database created successfully!"
    } || {
        echo "❌ Failed. Wrong password or MySQL not running."
        echo "   Try: mysql -u root -p < scripts/create-mysql-tables.sql"
        exit 1
    }
fi

# Verify tables
echo ""
echo "📊 Verifying tables..."
if [ -z "$MYSQL_PASSWORD" ]; then
    mysql -u root carelum_local -e "SHOW TABLES;" 2>/dev/null || \
    sudo mysql carelum_local -e "SHOW TABLES;" 2>/dev/null
else
    mysql -u root -p"$MYSQL_PASSWORD" carelum_local -e "SHOW TABLES;" 2>/dev/null
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Install sync server: cd scripts && npm install"
echo "   2. Start sync server: node db-sync-server.js"
echo ""
