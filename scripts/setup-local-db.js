#!/usr/bin/env node

/**
 * Setup Local Database Server
 * Creates a local MySQL/MongoDB server for inspecting app data
 */

const fs = require('fs');
const path = require('path');

console.log('🗄️  Setting up local database server for inspection...\n');

// Check if MySQL or MongoDB is installed
const checkMySQL = () => {
  try {
    require('mysql2');
    return true;
  } catch {
    return false;
  }
};

const checkMongoDB = () => {
  try {
    require('mongodb');
    return true;
  } catch {
    return false;
  }
};

// Create sync server
const createSyncServer = (dbType) => {
  const serverCode = dbType === 'mysql' ? `
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'carelum_local'
});

app.post('/sync', async (req, res) => {
  const { collection, data } = req.body;
  
  try {
    for (const item of data) {
      const keys = Object.keys(item);
      const values = Object.values(item);
      const placeholders = keys.map(() => '?').join(', ');
      const updateClause = keys.map(k => \`\${k} = ?\`).join(', ');
      
      await db.query(
        \`INSERT INTO \${collection} (\${keys.join(', ')}) VALUES (\${placeholders}) ON DUPLICATE KEY UPDATE \${updateClause}\`,
        [...values, ...values]
      );
    }
    res.json({ success: true, synced: data.length });
  } catch (error) {
    console.error('Sync error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.get('/query/:collection', async (req, res) => {
  try {
    const [rows] = await db.query(\`SELECT * FROM \${req.params.collection}\`);
    res.json(rows);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('✅ Sync server running on http://localhost:3001');
  console.log('📊 Access: http://localhost:3001/query/users');
});
` : `
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
const db = client.db(process.env.DB_NAME || 'carelum_local');

app.post('/sync', async (req, res) => {
  const { collection, data } = req.body;
  
  try {
    const coll = db.collection(collection);
    for (const item of data) {
      await coll.replaceOne(
        { id: item.id },
        item,
        { upsert: true }
      );
    }
    res.json({ success: true, synced: data.length });
  } catch (error) {
    console.error('Sync error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.get('/query/:collection', async (req, res) => {
  try {
    const coll = db.collection(req.params.collection);
    const data = await coll.find({}).toArray();
    res.json(data);
  } catch (error) {
    res.json({ error: error.message });
  }
});

(async () => {
  await client.connect();
  app.listen(3001, () => {
    console.log('✅ Sync server running on http://localhost:3001');
    console.log('📊 Access: http://localhost:3001/query/users');
  });
})();
`;

  const serverPath = path.join(__dirname, 'db-sync-server.js');
  fs.writeFileSync(serverPath, serverCode);
  console.log(`✅ Created sync server: ${serverPath}`);
};

// Create package.json for sync server
const createPackageJson = (dbType) => {
  const dependencies = {
    express: '^4.18.2',
    cors: '^2.8.5',
  };

  if (dbType === 'mysql') {
    dependencies.mysql2 = '^3.6.0';
  } else {
    dependencies.mongodb = '^6.0.0';
  }

  const packageJson = {
    name: 'carelum-db-sync-server',
    version: '1.0.0',
    description: 'Local database sync server for Carelum app inspection',
    main: 'db-sync-server.js',
    scripts: {
      start: 'node db-sync-server.js',
    },
    dependencies,
  };

  const packagePath = path.join(__dirname, 'db-sync-server-package.json');
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log(`✅ Created package.json: ${packagePath}`);
};

// Main setup
const main = () => {
  console.log('Choose database type:');
  console.log('1. MySQL');
  console.log('2. MongoDB');
  console.log('\nNote: You need to install the database separately.');
  console.log('\nMySQL: sudo apt-get install mysql-server (Linux) or brew install mysql (macOS)');
  console.log('MongoDB: sudo apt-get install mongodb (Linux) or brew install mongodb-community (macOS)\n');

  // Default to MySQL
  const dbType = process.argv[2] || 'mysql';
  
  if (dbType !== 'mysql' && dbType !== 'mongodb') {
    console.error('❌ Invalid database type. Use "mysql" or "mongodb"');
    process.exit(1);
  }

  createSyncServer(dbType);
  createPackageJson(dbType);

  console.log('\n📝 Next steps:');
  console.log('1. Install dependencies: cd scripts && npm install');
  console.log('2. Set up database (MySQL or MongoDB)');
  console.log('3. Create database: CREATE DATABASE carelum_local;');
  console.log('4. Start sync server: npm start');
  console.log('5. In your app, call syncToLocalDB() to sync data');
  console.log('\n✅ Setup complete!');
};

main();
