/**
 * Database Sync Server
 * Syncs AsyncStorage data from mobile app to local MySQL/MongoDB
 * Run: node scripts/db-sync-server.js
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Database type: 'mysql' or 'mongodb'
const DB_TYPE = process.env.DB_TYPE || 'mysql';

let db;

// Initialize database connection
if (DB_TYPE === 'mysql') {
  const mysql = require('mysql2/promise');
  db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', // Set DB_PASSWORD environment variable if MySQL has a password
    database: process.env.DB_NAME || 'carelum_local',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  // Test connection (async)
  (async () => {
    try {
      await db.query('SELECT 1');
      console.log('✅ Connected to MySQL');
    } catch (err) {
      console.error('❌ MySQL connection error:', err.message);
      console.log('💡 Tip: If MySQL has a password, set DB_PASSWORD environment variable');
      console.log('   Example: DB_PASSWORD=your_password node db-sync-server.js');
    }
  })();
} else {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  (async () => {
    try {
      await client.connect();
      db = client.db(process.env.DB_NAME || 'carelum_local');
      console.log('✅ Connected to MongoDB');
    } catch (err) {
      console.error('❌ MongoDB connection error:', err.message);
    }
  })();
}

// Sync endpoint - receives data from app
app.post('/sync', async (req, res) => {
  const { collection, data } = req.body;
  
  if (!collection || !data || !Array.isArray(data)) {
    return res.json({ success: false, error: 'Invalid request' });
  }

  try {
    let synced = 0;

    if (DB_TYPE === 'mysql') {
      // MySQL sync
      // Reserved keywords that need backticks
      const reservedKeywords = ['read', 'status', 'type', 'timestamp', 'order', 'group', 'select', 'table'];
      
      for (const item of data) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        // Escape reserved keywords with backticks
        const escapedKeys = keys.map(k => reservedKeywords.includes(k.toLowerCase()) ? `\`${k}\`` : k);
        const placeholders = keys.map(() => '?').join(', ');
        const updateClause = escapedKeys.map((k, i) => `${k} = ?`).join(', ');
        
        await db.query(
          `INSERT INTO ${collection} (${escapedKeys.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
          [...values, ...values]
        );
        synced++;
      }
    } else {
      // MongoDB sync
      const coll = db.collection(collection);
      for (const item of data) {
        await coll.replaceOne(
          { id: item.id },
          item,
          { upsert: true }
        );
        synced++;
      }
    }

    res.json({ success: true, synced });
  } catch (error) {
    console.error('Sync error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Query endpoint - get data from database
app.get('/query/:collection', async (req, res) => {
  try {
    if (DB_TYPE === 'mysql') {
      const [rows] = await db.query(`SELECT * FROM ${req.params.collection}`);
      res.json(rows);
    } else {
      const coll = db.collection(req.params.collection);
      const data = await coll.find({}).toArray();
      res.json(data);
    }
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: DB_TYPE });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Sync server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${DB_TYPE}`);
  console.log(`📝 Query endpoint: http://localhost:${PORT}/query/users`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
});
