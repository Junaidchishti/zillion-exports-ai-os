import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DB_DIR, 'zillion_factory.db');

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
    persistDb(dbInstance);
  }

  // Enable foreign key constraints
  dbInstance.run('PRAGMA foreign_keys = ON;');

  return dbInstance;
}

export function persistDb(db?: Database): void {
  const activeDb = db || dbInstance;
  if (!activeDb) return;
  try {
    const data = activeDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

// Database helper utilities
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  
  const changesRes = db.exec('SELECT changes() as count, last_insert_rowid() as id');
  const changes = changesRes[0]?.values[0]?.[0] as number || 0;
  const lastInsertRowid = changesRes[0]?.values[0]?.[1] as number || 0;
  
  persistDb(db);
  return { changes, lastInsertRowid };
}

export async function executeBatch(statements: string): Promise<void> {
  const db = await getDb();
  db.exec(statements);
  persistDb(db);
}
