import { resetDatabase, testDatabaseUrl } from "../../scripts/db-test";

/** Fresh database (auth stub + all migrations + seed) once per integration run. */
export default async function setup(): Promise<void> {
  await resetDatabase(testDatabaseUrl(), { seed: true });
}
