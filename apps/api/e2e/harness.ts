import { spawn, type ChildProcess } from 'node:child_process';
import { Client } from 'pg';

/**
 * E2E harness: boots the built server (`dist/apps/api/main.js`) and exercises it over real HTTP
 * with node:test. Jest is not used because several @nestjs/* packages are ESM-only
 * (`import.meta.url`), and testing the deployed webpack bundle is more faithful anyway.
 */

/**
 * Shared by every e2e file together with the kitty_test database, so files must run
 * sequentially (`--test-concurrency=1` in `pnpm e2e`).
 */
const PORT = 3999;
export const BASE = `http://localhost:${PORT}/api`;

const DB = {
  host: process.env['DATABASE_HOST'] ?? 'localhost',
  port: Number(process.env['DATABASE_PORT'] ?? 5434),
  user: process.env['DATABASE_USER'] ?? 'kitty',
  password: process.env['DATABASE_PASSWORD'] ?? 'kitty_dev_password',
  database: 'kitty_test',
};

let server: ChildProcess | undefined;
let db: Client | undefined;

/**
 * @description Migrates kitty_test to the latest schema. Required because the e2e server
 * runs `main.js` directly, bypassing docker-entrypoint.sh; a stale schema shows up as random 500s.
 * @throws {Error} When the migration process exits with a non-zero code.
 */
async function migrate(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('pnpm', ['db:migrate'], {
      env: { ...process.env, DATABASE_NAME: DB.database },
      stdio: 'ignore',
    });
    proc.on('error', reject);
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`migration failed with exit code ${code}`)),
    );
  });
}

/**
 * @description Migrates the test database, spawns the API on the e2e port, waits for /health
 * and opens a direct DB connection for resets.
 * @throws {Error} When the server is not healthy within 30 seconds.
 */
export async function startServer(): Promise<void> {
  await migrate();
  server = spawn('node', ['dist/apps/api/main.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      DATABASE_NAME: 'kitty_test',
      // Keep test receipt files out of the dev upload directory.
      UPLOAD_DIR: 'apps/api/uploads-test',
    },
    stdio: 'ignore',
  });

  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      if ((await fetch(`${BASE}/health`)).ok) {
        db = new Client(DB);
        await db.connect();
        return;
      }
    } catch {
      /* not up yet, retry */
    }
  }
  throw new Error('e2e server did not start within 30 seconds');
}

/** @description Closes the DB connection and kills the server process. */
export async function stopServer(): Promise<void> {
  await db?.end();
  server?.kill('SIGKILL');
}

/**
 * @description Wipes all data between tests with TRUNCATE ... CASCADE (no FK ordering to maintain),
 * then re-seeds the built-in categories, which the cascade also removes, so every test
 * starts from the freshly migrated state.
 * @throws {Error} When called before `startServer`.
 */
export async function resetDatabase(): Promise<void> {
  if (!db) throw new Error('Database not connected');
  await db.query(`
    TRUNCATE TABLE
      activity_logs, receipts, expense_shares, expense_payers,
      expenses, payments, group_sessions, members, groups, categories
    RESTART IDENTITY CASCADE
  `);
  // Must match the seed in the AddConstraints migration.
  await db.query(`
    INSERT INTO categories (group_id, name, icon, color, sort_order) VALUES
      (NULL, 'Food',          'utensils',        '#F97316', 1),
      (NULL, 'Groceries',     'shopping-basket', '#22C55E', 2),
      (NULL, 'Travel',        'plane',           '#0EA5E9', 3),
      (NULL, 'Transport',     'car',             '#6366F1', 4),
      (NULL, 'Entertainment', 'party-popper',    '#EC4899', 5),
      (NULL, 'Bills',         'receipt',         '#EF4444', 6),
      (NULL, 'Shopping',      'shopping-bag',    '#A855F7', 7)
  `);
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

/**
 * @description Sends a JSON request to the e2e server.
 * @param method - HTTP method.
 * @param path - Path relative to `/api`.
 * @param opts - Optional bearer token and JSON body.
 * @returns Status code and parsed JSON body (null when empty).
 */
export async function api<T = unknown>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}
