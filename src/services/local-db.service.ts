/**
 * Local Database Service (SQLite)
 * Handles all local database operations
 */
import * as SQLite from 'expo-sqlite';
import { ServiceResult } from '@/src/types/error.types';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize database and create tables
 */
export async function initDatabase(): Promise<ServiceResult<void>> {
  try {
    db = await SQLite.openDatabaseAsync('carelum.db');
    
    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');
    
    // Create tables
    await createTables();
    
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DB_INIT_ERROR',
        message: `Failed to initialize database: ${error.message}`,
      },
    };
  }
}

/**
 * Create all database tables
 */
async function createTables(): Promise<void> {
  if (!db) return;

  // Users table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      displayName TEXT,
      role TEXT NOT NULL,
      phoneNumber TEXT,
      profileImageUrl TEXT,
      preferredLanguage TEXT DEFAULT 'en',
      theme TEXT DEFAULT 'auto',
      isVerified INTEGER DEFAULT 0,
      verificationStatus TEXT,
      hourlyRate REAL,
      bio TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      lastLoginAt INTEGER
    );
  `);

  // Children table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      parentId TEXT NOT NULL,
      name TEXT NOT NULL,
      age INTEGER,
      dateOfBirth INTEGER,
      gender TEXT,
      photoUrl TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (parentId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Child instructions table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS child_instructions (
      id TEXT PRIMARY KEY,
      childId TEXT NOT NULL,
      parentId TEXT NOT NULL,
      feedingSchedule TEXT,
      napSchedule TEXT,
      bedtime TEXT,
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
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (childId) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (parentId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Sessions table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      parentId TEXT NOT NULL,
      sitterId TEXT NOT NULL,
      childId TEXT NOT NULL,
      status TEXT NOT NULL,
      startTime INTEGER,
      endTime INTEGER,
      duration REAL,
      locationAddress TEXT,
      locationLatitude REAL,
      locationLongitude REAL,
      hourlyRate REAL,
      totalAmount REAL,
      paymentStatus TEXT,
      instructions TEXT,
      specialNotes TEXT,
      gpsTrackingEnabled INTEGER DEFAULT 0,
      monitoringEnabled INTEGER DEFAULT 0,
      cryDetectionEnabled INTEGER DEFAULT 0,
      completedAt INTEGER,
      parentRating INTEGER,
      parentReview TEXT,
      sitterRating INTEGER,
      sitterReview TEXT,
      cancelledAt INTEGER,
      cancelledBy TEXT,
      cancellationReason TEXT,
      firebaseSynced INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (parentId) REFERENCES users(id),
      FOREIGN KEY (sitterId) REFERENCES users(id),
      FOREIGN KEY (childId) REFERENCES children(id)
    );
  `);

  // Verification requests table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      sitterId TEXT NOT NULL,
      fullName TEXT,
      dateOfBirth INTEGER,
      idNumber TEXT,
      idDocumentUrl TEXT,
      backgroundCheckUrl TEXT,
      certifications TEXT,
      status TEXT,
      submittedAt INTEGER,
      reviewedAt INTEGER,
      reviewedBy TEXT,
      rejectionReason TEXT,
      bio TEXT,
      qualifications TEXT,
      hourlyRate REAL,
      firebaseSynced INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (sitterId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Reviews table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      reviewerId TEXT NOT NULL,
      revieweeId TEXT NOT NULL,
      reviewerRole TEXT,
      rating INTEGER,
      review TEXT,
      categories TEXT,
      firebaseSynced INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );
  `);

  // Create indexes
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parentId);
    CREATE INDEX IF NOT EXISTS idx_sessions_sitter ON sessions(sitterId);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parentId);
    CREATE INDEX IF NOT EXISTS idx_instructions_child ON child_instructions(childId);
  `);
}

/**
 * Generic insert function
 */
export async function insert<T extends { id: string }>(
  table: string,
  data: T
): Promise<ServiceResult<T>> {
  try {
    if (!db) {
      const initResult = await initDatabase();
      if (!initResult.success) return initResult as any;
    }

    const keys = Object.keys(data).filter(k => k !== 'id');
    const values = keys.map(k => data[k as keyof T]);
    const placeholders = keys.map(() => '?').join(', ');
    const columns = keys.join(', ');

    const sql = `INSERT OR REPLACE INTO ${table} (id, ${columns}) VALUES (?, ${placeholders})`;
    
    await db!.runAsync(sql, [data.id, ...values]);

    return { success: true, data };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DB_INSERT_ERROR',
        message: `Failed to insert into ${table}: ${error.message}`,
      },
    };
  }
}

/**
 * Generic select function
 */
export async function select<T>(
  table: string,
  whereClause?: string,
  params?: any[]
): Promise<ServiceResult<T[]>> {
  try {
    if (!db) {
      const initResult = await initDatabase();
      if (!initResult.success) return initResult as any;
    }

    const sql = whereClause
      ? `SELECT * FROM ${table} WHERE ${whereClause}`
      : `SELECT * FROM ${table}`;

    const result = await db!.getAllAsync(sql, params || []);
    return { success: true, data: result as T[] };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DB_SELECT_ERROR',
        message: `Failed to select from ${table}: ${error.message}`,
      },
    };
  }
}

/**
 * Generic update function
 */
export async function update(
  table: string,
  id: string,
  data: Partial<any>
): Promise<ServiceResult<void>> {
  try {
    if (!db) {
      const initResult = await initDatabase();
      if (!initResult.success) return initResult;
    }

    const keys = Object.keys(data);
    const values = keys.map(k => data[k]);
    const setClause = keys.map(k => `${k} = ?`).join(', ');

    const sql = `UPDATE ${table} SET ${setClause}, updatedAt = ? WHERE id = ?`;
    
    await db!.runAsync(sql, [...values, Date.now(), id]);

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DB_UPDATE_ERROR',
        message: `Failed to update ${table}: ${error.message}`,
      },
    };
  }
}

/**
 * Generic delete function
 */
export async function remove(
  table: string,
  id: string
): Promise<ServiceResult<void>> {
  try {
    if (!db) {
      const initResult = await initDatabase();
      if (!initResult.success) return initResult;
    }

    const sql = `DELETE FROM ${table} WHERE id = ?`;
    await db!.runAsync(sql, [id]);

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DB_DELETE_ERROR',
        message: `Failed to delete from ${table}: ${error.message}`,
      },
    };
  }
}

/**
 * Execute raw SQL
 */
export async function execute(sql: string, params?: any[]): Promise<ServiceResult<any>> {
  try {
    if (!db) {
      const initResult = await initDatabase();
      if (!initResult.success) return initResult;
    }

    const result = await db!.runAsync(sql, params || []);
    return { success: true, data: result };
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'DB_EXECUTE_ERROR',
        message: `Failed to execute SQL: ${error.message}`,
      },
    };
  }
}

/**
 * Get database instance
 */
export function getDatabase(): SQLite.SQLiteDatabase | null {
  return db;
}
