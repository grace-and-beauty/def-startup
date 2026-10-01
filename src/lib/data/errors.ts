import type { PostgrestError } from "@supabase/supabase-js";

/** Error thrown by src/lib/data/* when Supabase returns an error. */
export class DataError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  readonly hint: string | undefined;

  constructor(operation: string, error: PostgrestError) {
    super(`${operation}: ${error.message}`);
    this.name = "DataError";
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }

  /** Postgres unique_violation. */
  get isUniqueViolation(): boolean {
    return this.code === "23505";
  }

  /** insufficient_privilege (RLS / protect_billing_fields / analytics guard). */
  get isForbidden(): boolean {
    return this.code === "42501";
  }
}

interface Result<T> {
  data: T | null;
  error: PostgrestError | null;
}

/** Throws DataError on error; returns data (null allowed). */
export function unwrap<T>(operation: string, { data, error }: Result<T>): T | null {
  if (error) throw new DataError(operation, error);
  return data;
}

/** Throws DataError on error or when no data came back. */
export function unwrapRequired<T>(operation: string, result: Result<T>): T {
  const data = unwrap(operation, result);
  if (data === null || data === undefined) {
    throw new Error(`${operation}: no data returned`);
  }
  return data;
}

/** Escape user input for PostgREST ilike filters inside .or(...). */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/[,()*%\\:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}
