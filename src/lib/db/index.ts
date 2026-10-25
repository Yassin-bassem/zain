import { Pool, Client } from 'pg';

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<number>;
}

let isInitialized = false;
let pgliteInstance: any = null;

const globalForDb = global as unknown as { pool?: Pool };

const DEFAULT_SUPABASE_URL =
  'postgresql://postgres.lftpaujmbpfbawdwmfxh:Yassin1980%24bassem@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

export function getDatabaseUrl(): string | undefined {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_SUPABASE) {
    return process.env.DATABASE_URL;
  }
  return process.env.DATABASE_URL || DEFAULT_SUPABASE_URL;
}

export function getPool(databaseUrl?: string): Pool {
  if (globalForDb.pool) return globalForDb.pool;

  const url = databaseUrl || getDatabaseUrl() || DEFAULT_SUPABASE_URL;
  const isSupabaseOrSsl =
    url.includes('supabase') ||
    url.includes('sslmode=require') ||
    url.includes('pooler.supabase.com');

  const pool = new Pool({
    connectionString: url,
    ssl: isSupabaseOrSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  globalForDb.pool = pool;
  return pool;
}

export async function withClient<T>(fn: (client: Client | any) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function getDb(): Promise<{
  isPostgres: boolean;
  client: DbClient;
}> {
  return {
    isPostgres: true,
    client: {
      query: (sql, params) => query(sql, params),
      queryOne: (sql, params) => queryOne(sql, params),
      execute: (sql, params) => execute(sql, params),
    },
  };
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  await ensureInitialized();
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl && process.env.NODE_ENV === 'test') {
    const db = await getTestDb();
    return db.query<T>(sql, params);
  }
  const pool = getPool(databaseUrl || DEFAULT_SUPABASE_URL);
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  await ensureInitialized();
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl && process.env.NODE_ENV === 'test') {
    const db = await getTestDb();
    return db.queryOne<T>(sql, params);
  }
  const pool = getPool(databaseUrl || DEFAULT_SUPABASE_URL);
  const res = await pool.query(sql, params);
  return (res.rows[0] as T) || null;
}

export async function execute(sql: string, params?: any[]): Promise<number> {
  await ensureInitialized();
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl && process.env.NODE_ENV === 'test') {
    const db = await getTestDb();
    return db.execute(sql, params);
  }
  const pool = getPool(databaseUrl || DEFAULT_SUPABASE_URL);
  const res = await pool.query(sql, params);
  return res.rowCount || 0;
}

export async function transaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  await ensureInitialized();
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl && process.env.NODE_ENV === 'test') {
    return await testDbTransaction(fn);
  }

  const pool = getPool(databaseUrl || DEFAULT_SUPABASE_URL);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txClient: DbClient = {
      async query<R = any>(sql: string, params?: any[]): Promise<R[]> {
        const res = await client.query(sql, params);
        return res.rows as R[];
      },
      async queryOne<R = any>(sql: string, params?: any[]): Promise<R | null> {
        const res = await client.query(sql, params);
        return (res.rows[0] as R) || null;
      },
      async execute(sql: string, params?: any[]): Promise<number> {
        const res = await client.query(sql, params);
        return res.rowCount || 0;
      },
    };

    const result = await fn(txClient);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

async function getTestDb(): Promise<DbClient> {
  if (!pgliteInstance) {
    const { PGlite } = await import('@electric-sql/pglite');
    pgliteInstance = new PGlite();
  }

  return {
    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
      const res = await pgliteInstance.query(sql, params);
      return (res.rows as T[]) || [];
    },
    async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
      const res = await pgliteInstance.query(sql, params);
      return ((res.rows as T[])[0]) || null;
    },
    async execute(sql: string, params?: any[]): Promise<number> {
      const res = await pgliteInstance.query(sql, params);
      return res.affectedRows || res.rows.length || 0;
    },
  };
}

async function testDbTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  await getTestDb();
  return await pgliteInstance.transaction(async (tx: any) => {
    const txClient: DbClient = {
      async query<R = any>(sql: string, params?: any[]): Promise<R[]> {
        const res = await tx.query(sql, params);
        return (res.rows as R[]) || [];
      },
      async queryOne<R = any>(sql: string, params?: any[]): Promise<R | null> {
        const res = await tx.query(sql, params);
        return ((res.rows as R[])[0]) || null;
      },
      async execute(sql: string, params?: any[]): Promise<number> {
        const res = await tx.query(sql, params);
        return res.affectedRows || res.rows.length || 0;
      },
    };
    return await fn(txClient);
  });
}

import { runMigrations } from './migrations';

export async function ensureInitialized() {
  if (isInitialized) return;
  isInitialized = true;

  // Only run schema setup in PGlite in-memory test environment
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_SUPABASE) {
    try {
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.resolve(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await getTestDb();
        if (pgliteInstance) {
          await pgliteInstance.exec(schemaSql);
        }
      }
    } catch (e) {
      console.warn('Schema setup skipped:', e);
    }

    const client = await getTestDb();

    // Seed default warehouse location
    const mainLoc = await client.queryOne(
      `SELECT id FROM inventory_locations WHERE location_code = $1`,
      ['MAIN']
    );
    if (!mainLoc) {
      await client.execute(
        `INSERT INTO inventory_locations (name, location_code, location_type, active)
         VALUES ($1, $2, $3, $4)`,
        ['المستودع الرئيسي', 'MAIN', 'warehouse', true]
      );
    }

    // Seed default sizes
    const defaultSizes = [
      { name: 'حديث ولادة (0-3 شهور)', sort_order: 1 },
      { name: '3-6 شهور', sort_order: 2 },
      { name: '6-9 شهور', sort_order: 3 },
      { name: '9-12 شهر', sort_order: 4 },
      { name: '1 سنة', sort_order: 5 },
      { name: '2 سنة', sort_order: 6 },
      { name: '3 سنوات', sort_order: 7 },
      { name: '4 سنوات', sort_order: 8 },
      { name: '5 سنوات', sort_order: 9 },
      { name: '6 سنوات', sort_order: 10 },
      { name: '8 سنوات', sort_order: 11 },
      { name: '10 سنوات', sort_order: 12 },
      { name: '12 سنة', sort_order: 13 },
      { name: '14 سنة', sort_order: 14 },
      { name: '16 سنة', sort_order: 15 },
    ];

    for (const s of defaultSizes) {
      const existing = await client.queryOne('SELECT id FROM sizes WHERE name = $1', [s.name]);
      if (!existing) {
        await client.execute('INSERT INTO sizes (name, sort_order) VALUES ($1, $2)', [s.name, s.sort_order]);
      }
    }

    // Seed standard categories
    const defaultCategories = ['ولادي', 'بناتي', 'حديثي الولادة', 'بيجامات', 'قطنيات', 'ملابس صيفي', 'ملابس شتوي'];
    for (const c of defaultCategories) {
      const existing = await client.queryOne('SELECT id FROM categories WHERE name = $1', [c]);
      if (!existing) {
        await client.execute('INSERT INTO categories (name) VALUES ($1)', [c]);
      }
    }

    // Seed default colors
    const defaultColors = [
      { name: 'أبيض', hex: '#FFFFFF' },
      { name: 'أسود', hex: '#111111' },
      { name: 'كحلي', hex: '#0B1D51' },
      { name: 'رمادي', hex: '#708090' },
      { name: 'أحمر', hex: '#D2143A' },
      { name: 'وردي', hex: '#FFB6C1' },
      { name: 'سماوي', hex: '#87CEEB' },
      { name: 'أصفر', hex: '#FDD835' },
      { name: 'زيتي', hex: '#556B2F' },
      { name: 'بيج', hex: '#F5F5DC' },
      { name: 'كشمير', hex: '#D8A19F' },
      { name: 'تركواز', hex: '#40E0D0' },
      { name: 'موف', hex: '#9370DB' },
    ];

    for (const col of defaultColors) {
      const normalized = normalizeArabicText(col.name);
      const existing = await client.queryOne('SELECT id FROM colors WHERE normalized_name = $1', [normalized]);
      if (!existing) {
        await client.execute(
          'INSERT INTO colors (name, normalized_name, hex_code) VALUES ($1, $2, $3)',
          [col.name, normalized, col.hex]
        );
      }
    }

    await runMigrations(client);
    return;
  }

  // In live production, migrations are already completed on Supabase!
  // Only execute migrations if explicitly requested via environment variable
  if (process.env.RUN_MIGRATIONS === 'true') {
    const databaseUrl = getDatabaseUrl();
    if (databaseUrl) {
      try {
        await withClient(async (client) => {
          const dbClient: DbClient = {
            query: (sql, params) => client.query(sql, params).then((r: any) => r.rows),
            queryOne: (sql, params) => client.query(sql, params).then((r: any) => r.rows[0] || null),
            execute: (sql, params) => client.query(sql, params).then((r: any) => r.rowCount || 0),
          };
          await runMigrations(dbClient);
        });
      } catch (err) {
        console.warn('Migration on PostgreSQL:', err);
      }
    }
  }
}

export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

export async function resetDatabaseForTests() {
  isInitialized = false;
  if (pgliteInstance) {
    try {
      await pgliteInstance.close();
    } catch {}
    pgliteInstance = null;
  }
  await ensureInitialized();
}
