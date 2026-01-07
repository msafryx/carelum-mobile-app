#!/bin/bash

# Fix MySQL Root Access
# This script helps reset MySQL root password if needed

echo "🔧 Fixing MySQL root access..."
echo ""

# Method 1: Try connecting without password (if MySQL uses auth_socket)
echo "Method 1: Trying to connect without password..."
mysql -u root <<EOF 2>&1 | head -5
SELECT 'Connected successfully!' AS status;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Success! MySQL root access works without password"
    echo ""
    echo "Creating database and tables..."
    mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS carelum_local;
USE carelum_local;
SOURCE scripts/create-mysql-tables.sql;
SELECT 'Database setup complete!' AS status;
EOF
    exit 0
fi

# Method 2: Try with sudo (uses auth_socket on Ubuntu)
echo ""
echo "Method 2: Trying with sudo (auth_socket)..."
sudo mysql -u root <<EOF 2>&1 | head -5
SELECT 'Connected with sudo!' AS status;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Success! MySQL root access works with sudo"
    echo ""
    echo "Setting up database..."
    sudo mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS carelum_local;
USE carelum_local;
SOURCE scripts/create-mysql-tables.sql;
SELECT 'Database setup complete!' AS status;
EOF
    exit 0
fi

# Method 3: Reset password
echo ""
echo "Method 3: Need to reset MySQL root password"
echo ""
echo "Please run these commands manually:"
echo ""
echo "1. Stop MySQL:"
echo "   sudo systemctl stop mysql"
echo ""
echo "2. Start MySQL in safe mode:"
echo "   sudo mysqld_safe --skip-grant-tables &"
echo ""
echo "3. Connect and reset password:"
echo "   mysql -u root"
echo "   USE mysql;"
echo "   ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';"
echo "   FLUSH PRIVILEGES;"
echo "   exit;"
echo ""
echo "4. Restart MySQL:"
echo "   sudo systemctl restart mysql"
echo ""
echo "5. Try connecting again:"
echo "   mysql -u root"
echo ""
