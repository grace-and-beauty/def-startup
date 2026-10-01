import { Client } from "pg";

import { testDatabaseUrl } from "../../scripts/db-test";

export const DEMO = {
  ownerId: "00000000-0000-4000-8000-000000000001",
  businessId: "00000000-0000-4000-8000-000000000101",
  programId: "00000000-0000-4000-8000-000000000201",
  staffId: "00000000-0000-4000-8000-000000000301",
  staff2Id: "00000000-0000-4000-8000-000000000302",
} as const;

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  return client;
}

export type DbRole = "anon" | "authenticated" | "service_role";

/**
 * Run fn inside a transaction as a Supabase API role, the way PostgREST does
 * (SET LOCAL ROLE + request.jwt.claim.sub). Always rolled back unless commit=true.
 */
export async function asRole<T>(
  client: Client,
  role: DbRole,
  userId: string | null,
  fn: (c: Client) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    const result = await fn(client);
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}
