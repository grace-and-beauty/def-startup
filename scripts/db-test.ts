/**
 * Local test database on plain PostgreSQL (no Docker / Supabase CLI needed).
 *
 *   npm run db:test:up     drop + create the database, apply the auth stub,
 *                          every migration in supabase/migrations and seed.sql
 *   npm run db:test:down   drop the database
 *
 * Options (up): --no-seed
 * Env: TEST_DATABASE_URL (default postgresql://postgres:postgres@localhost:5432/loyalty_test)
 *
 * The connecting role must be able to CREATE/DROP DATABASE and create roles
 * (the stub creates anon / authenticated / service_role if missing).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/loyalty_test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUB_FILE = path.join(ROOT, "tests/integration/auth-stub.sql");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const SEED_FILE = path.join(ROOT, "supabase/seed.sql");

export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
}

function splitUrl(url: string): { dbName: string; adminUrl: string } {
  const u = new URL(url);
  const dbName = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!/^[a-z0-9_]+$/.test(dbName)) {
    throw new Error(`Refusing to manage database with unexpected name "${dbName}"`);
  }
  if (["postgres", "template0", "template1"].includes(dbName)) {
    throw new Error(`Refusing to drop system database "${dbName}"`);
  }
  u.pathname = "/postgres";
  return { dbName, adminUrl: u.toString() };
}

async function withClient<T>(url: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function dropDatabase(url = testDatabaseUrl()): Promise<void> {
  const { dbName, adminUrl } = splitUrl(url);
  await withClient(adminUrl, (c) => c.query(`drop database if exists "${dbName}" with (force)`));
}

async function applyFile(client: Client, file: string, log: (m: string) => void): Promise<void> {
  const sql = await readFile(file, "utf8");
  const label = path.relative(ROOT, file);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    log(`  ✓ ${label}`);
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw new Error(`Failed applying ${label}: ${(err as Error).message}`, { cause: err });
  }
}

export async function listMigrations(): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  return files.map((f) => path.join(MIGRATIONS_DIR, f));
}

export interface ResetOptions {
  seed?: boolean;
  log?: (message: string) => void;
}

/** Recreate the database from scratch: stub → migrations → (seed). */
export async function resetDatabase(
  url = testDatabaseUrl(),
  { seed = true, log = () => undefined }: ResetOptions = {},
): Promise<void> {
  const { dbName, adminUrl } = splitUrl(url);
  await withClient(adminUrl, async (c) => {
    await c.query(`drop database if exists "${dbName}" with (force)`);
    await c.query(`create database "${dbName}"`);
  });
  log(`database "${dbName}" recreated`);

  await withClient(url, async (c) => {
    // Surface NOTICEs from migrations only on failure; keep output tidy.
    c.on("notice", () => undefined);
    await applyFile(c, STUB_FILE, log);
    for (const file of await listMigrations()) {
      await applyFile(c, file, log);
    }
    if (seed) {
      await applyFile(c, SEED_FILE, log);
    }
  });
}

async function summary(url: string): Promise<string> {
  return withClient(url, async (c) => {
    const { rows } = await c.query<{ t: string; n: string }>(`
      select 'businesses' as t, count(*)::text as n from public.businesses
      union all select 'programs', count(*)::text from public.programs
      union all select 'staff', count(*)::text from public.staff
      union all select 'customers', count(*)::text from public.customers
      union all select 'cards', count(*)::text from public.cards
      union all select 'stamp_events', count(*)::text from public.stamp_events
      union all select 'messages', count(*)::text from public.messages`);
    return rows.map((r) => `${r.t}=${r.n}`).join(" ");
  });
}

async function main(): Promise<void> {
  const [command, ...flags] = process.argv.slice(2);
  const url = testDatabaseUrl();
  const log = (m: string) => console.log(m);

  if (command === "up") {
    await resetDatabase(url, { seed: !flags.includes("--no-seed"), log });
    log(`rows: ${await summary(url)}`);
    log("done");
  } else if (command === "down") {
    await dropDatabase(url);
    log(`database "${splitUrl(url).dbName}" dropped`);
  } else {
    console.error("usage: tsx scripts/db-test.ts <up|down> [--no-seed]");
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
