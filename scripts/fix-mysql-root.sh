#!/bin/bash

# Fix MySQL Root Access and Setup Database
# Run: bash scripts/fix-mysql-root.sh

echo "🔧 Fixing MySQL root access..."
echo ""

# Method 1: Try connecting with sudo (no -u root needed)
echo "Method 1: Connecting with sudo mysql..."
sudo mysql <<'MYSQL_SCRIPT'
SELECT '✅ Connected successfully!' AS status;

-- Create database
CREATE DATABASE IF NOT EXISTS carelum_local;
USE carelum_local;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  displayName VARCHAR(255),
  role VARCHAR(50) NOT NULL,
  phoneNumber VARCHAR(50),
  profileImageUrl TEXT,
  preferredLanguage VARCHAR(10) DEFAULT 'en',
  theme VARCHAR(20) DEFAULT 'auto',
  isVerified TINYINT(1) DEFAULT 0,
  verificationStatus VARCHAR(50),
  hourlyRate DECIMAL(10, 2),
  bio TEXT,
  createdAt BIGINT,
  updatedAt BIGINT,
  lastLoginAt BIGINT,
  INDEX idx_role (role),
  INDEX idx_email (email)
);

CREATE TABLE IF NOT EXISTS children (
  id VARCHAR(255) PRIMARY KEY,
  parentId VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  age INT,
  dateOfBirth BIGINT,
  gender VARCHAR(20),
  photoUrl TEXT,
  createdAt BIGINT,
  updatedAt BIGINT,
  INDEX idx_parent (parentId)
);

CREATE TABLE IF NOT EXISTS child_instructions (
  id VARCHAR(255) PRIMARY KEY,
  childId VARCHAR(255) NOT NULL,
  parentId VARCHAR(255) NOT NULL,
  feedingSchedule TEXT,
  napSchedule TEXT,
  bedtime VARCHAR(50),
  dietaryRestrictions TEXT,
  allergies TEXT,
  medications TEXT,
  favoriteActivities TEXT,
  comfortItems TEXT,
  routines TEXT,
  specialNeeds TEXT,
  emergencyContacts TEXT,
  doctorInfo TEXT,
  additionalNotes TEXT,
  instructionText TEXT,
  createdAt BIGINT,
  updatedAt BIGINT,
  INDEX idx_child (childId),
  INDEX idx_parent (parentId)
);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  parentId VARCHAR(255) NOT NULL,
  sitterId VARCHAR(255) NOT NULL,
  childId VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  startTime BIGINT,
  endTime BIGINT,
  duration DECIMAL(10, 2),
  locationAddress TEXT,
  locationLatitude DECIMAL(10, 8),
  locationLongitude DECIMAL(11, 8),
  hourlyRate DECIMAL(10, 2),
  totalAmount DECIMAL(10, 2),
  paymentStatus VARCHAR(50),
  instructions TEXT,
  specialNotes TEXT,
  gpsTrackingEnabled TINYINT(1) DEFAULT 0,
  monitoringEnabled TINYINT(1) DEFAULT 0,
  cryDetectionEnabled TINYINT(1) DEFAULT 0,
  completedAt BIGINT,
  parentRating INT,
  parentReview TEXT,
  sitterRating INT,
  sitterReview TEXT,
  cancelledAt BIGINT,
  cancelledBy VARCHAR(255),
  cancellationReason TEXT,
  firebaseSynced TINYINT(1) DEFAULT 0,
  createdAt BIGINT,
  updatedAt BIGINT,
  INDEX idx_parent (parentId),
  INDEX idx_sitter (sitterId),
  INDEX idx_status (status),
  INDEX idx_child (childId)
);

CREATE TABLE IF NOT EXISTS verification_requests (
  id VARCHAR(255) PRIMARY KEY,
  sitterId VARCHAR(255) NOT NULL,
  fullName VARCHAR(255),
  dateOfBirth BIGINT,
  idNumber VARCHAR(100),
  idDocumentUrl TEXT,
  backgroundCheckUrl TEXT,
  certifications TEXT,
  status VARCHAR(50),
  submittedAt BIGINT,
  reviewedAt BIGINT,
  reviewedBy VARCHAR(255),
  rejectionReason TEXT,
  bio TEXT,
  qualifications TEXT,
  hourlyRate DECIMAL(10, 2),
  firebaseSynced TINYINT(1) DEFAULT 0,
  createdAt BIGINT,
  updatedAt BIGINT,
  INDEX idx_sitter (sitterId),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(255) PRIMARY KEY,
  sessionId VARCHAR(255) NOT NULL,
  reviewerId VARCHAR(255) NOT NULL,
  revieweeId VARCHAR(255) NOT NULL,
  reviewerRole VARCHAR(50),
  rating INT,
  review TEXT,
  categories TEXT,
  firebaseSynced TINYINT(1) DEFAULT 0,
  createdAt BIGINT,
  updatedAt BIGINT,
  INDEX idx_session (sessionId),
  INDEX idx_reviewer (reviewerId),
  INDEX idx_reviewee (revieweeId)
);

CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(255) PRIMARY KEY,
  sessionId VARCHAR(255),
  parentId VARCHAR(255),
  sitterId VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  message TEXT,
  severity VARCHAR(20),
  acknowledged TINYINT(1) DEFAULT 0,
  acknowledgedAt BIGINT,
  createdAt BIGINT,
  INDEX idx_session (sessionId),
  INDEX idx_parent (parentId),
  INDEX idx_sitter (sitterId),
  INDEX idx_type (type)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(255) PRIMARY KEY,
  sessionId VARCHAR(255),
  senderId VARCHAR(255) NOT NULL,
  receiverId VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read TINYINT(1) DEFAULT 0,
  readAt BIGINT,
  createdAt BIGINT,
  INDEX idx_session (sessionId),
  INDEX idx_sender (senderId),
  INDEX idx_receiver (receiverId)
);

CREATE TABLE IF NOT EXISTS gps_tracking (
  id VARCHAR(255) PRIMARY KEY,
  sessionId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  timestamp BIGINT NOT NULL,
  INDEX idx_session (sessionId),
  INDEX idx_user (userId),
  INDEX idx_timestamp (timestamp)
);

SELECT '✅ All tables created successfully!' AS status;
SHOW TABLES;
MYSQL_SCRIPT

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup complete!"
    echo ""
    echo "📊 Verify with:"
    echo "   sudo mysql carelum_local -e 'SHOW TABLES;'"
    exit 0
fi

echo ""
echo "❌ Method 1 failed. Trying Method 2..."
echo ""
echo "Please run these commands manually:"
echo ""
echo "1. Connect to MySQL:"
echo "   sudo mysql"
echo ""
echo "2. In MySQL console, run:"
echo "   CREATE DATABASE IF NOT EXISTS carelum_local;"
echo "   USE carelum_local;"
echo "   SOURCE /home/muhammed_safry/My\\ Projects/Carelum/frontend/scripts/create-mysql-tables.sql;"
echo "   SHOW TABLES;"
echo "   exit;"
echo ""
