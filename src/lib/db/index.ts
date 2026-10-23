import { Pool, PoolClient } from 'pg';

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<number>;
}

let pgPool: Pool | null = null;
let pgliteInstance: any = null;
let isInitialized = false;

function getPgDataDir(): string {
  try {
    const path = require('path');
    const fs = require('fs');
    const baseDir = path.resolve(process.cwd(), 'data', 'pgdata');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  } catch {
    return '/tmp/pgdata';
  }
}

function createPgPool(databaseUrl: string): Pool {
  const isSupabaseOrSsl =
    databaseUrl.includes('supabase') ||
    databaseUrl.includes('sslmode=require') ||
    databaseUrl.includes('pooler.supabase.com');

  return new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isSupabaseOrSsl ? { rejectUnauthorized: false } : undefined,
  });
}

const DEFAULT_SUPABASE_URL =
  'postgresql://postgres.lftpaujmbpfbawdwmfxh:Yassin1980%24bassem@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

export function getDatabaseUrl(): string | undefined {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_SUPABASE) {
    return process.env.DATABASE_URL;
  }
  return process.env.DATABASE_URL || DEFAULT_SUPABASE_URL;
}

export async function getDb(): Promise<{
  isPostgres: boolean;
  client: DbClient;
  poolClient?: PoolClient;
}> {
  const databaseUrl = getDatabaseUrl();

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    if (!pgPool) {
      pgPool = createPgPool(databaseUrl);
    }

    const clientWrapper: DbClient = {
      async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
        const res = await pgPool!.query(sql, params);
        return res.rows as T[];
      },
      async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
        const res = await pgPool!.query(sql, params);
        return (res.rows[0] as T) || null;
      },
      async execute(sql: string, params?: any[]): Promise<number> {
        const res = await pgPool!.query(sql, params);
        return res.rowCount || 0;
      },
    };

    return { isPostgres: true, client: clientWrapper };
  }

  // Use embedded PGlite (Real PostgreSQL in Node.js)
  if (!pgliteInstance) {
    const { PGlite } = await import('@electric-sql/pglite');
    if (process.env.NODE_ENV === 'test' && !process.env.PERSIST_TEST_DB) {
      pgliteInstance = new PGlite();
    } else {
      const dataDir = getPgDataDir();
      pgliteInstance = new PGlite(dataDir);
    }
  }

  const clientWrapper: DbClient = {
    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
      const res = await pgliteInstance!.query(sql, params);
      return (res.rows as T[]) || [];
    },
    async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
      const res = await pgliteInstance!.query(sql, params);
      return ((res.rows as T[])[0]) || null;
    },
    async execute(sql: string, params?: any[]): Promise<number> {
      const res = await pgliteInstance!.query(sql, params);
      return res.affectedRows || res.rows.length || 0;
    },
  };

  return { isPostgres: false, client: clientWrapper };
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  await ensureInitialized();
  const db = await getDb();
  return db.client.query<T>(sql, params);
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  await ensureInitialized();
  const db = await getDb();
  return db.client.queryOne<T>(sql, params);
}

export async function execute(sql: string, params?: any[]): Promise<number> {
  await ensureInitialized();
  const db = await getDb();
  return db.client.execute(sql, params);
}

export async function transaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  await ensureInitialized();
  const databaseUrl = getDatabaseUrl();

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    if (!pgPool) {
      pgPool = createPgPool(databaseUrl);
    }
    const poolClient = await pgPool.connect();
    try {
      await poolClient.query('BEGIN');
      const txClient: DbClient = {
        async query<R = any>(sql: string, params?: any[]): Promise<R[]> {
          const res = await poolClient.query(sql, params);
          return res.rows as R[];
        },
        async queryOne<R = any>(sql: string, params?: any[]): Promise<R | null> {
          const res = await poolClient.query(sql, params);
          return (res.rows[0] as R) || null;
        },
        async execute(sql: string, params?: any[]): Promise<number> {
          const res = await poolClient.query(sql, params);
          return res.rowCount || 0;
        },
      };

      const result = await fn(txClient);
      await poolClient.query('COMMIT');
      return result;
    } catch (err) {
      await poolClient.query('ROLLBACK');
      throw err;
    } finally {
      poolClient.release();
    }
  }

  // PGlite transaction
  if (!pgliteInstance) {
    await getDb();
  }

  return await pgliteInstance!.transaction(async (tx) => {
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

export async function ensureInitialized() {
  if (isInitialized) return;

  const { isPostgres, client } = await getDb();

  if (!isPostgres) {
    try {
      const path = require('path');
      const fs = require('fs');
      const schemaPath = path.resolve(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        if (pgliteInstance) {
          await pgliteInstance.exec(schemaSql);
        }
      }
    } catch (e) {
      console.warn('Schema file skipped:', e);
    }
  }

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

  isInitialized = true;
}

export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove tashkeel (diacritics)
    .replace(/\s+/g, ' ');
}

export async function resetDatabaseForTests() {
  isInitialized = false;
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  await ensureInitialized();
}
