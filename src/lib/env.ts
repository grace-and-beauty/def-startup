/**
 * Typed access to environment variables (.env.example documents each one).
 * Getters read lazily so `next build` works without any secrets; a missing
 * required value fails only when the feature that needs it is used.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value;
}

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing environment variable ${name} (see .env.example)`);
    this.name = "MissingEnvError";
  }
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new MissingEnvError(name);
  return value;
}

export function siteUrl(): string {
  return (read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Public Supabase config. NEXT_PUBLIC_* must be referenced literally to be inlined in the browser bundle. */
export function supabasePublicEnv(): { url: string; anonKey: string } {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL || undefined),
    anonKey: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    ),
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Server only — never expose to the browser. */
export function supabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", read("SUPABASE_SERVICE_ROLE_KEY"));
}

export function stampCooldownMinutes(): number {
  const raw = read("STAMP_COOLDOWN_MINUTES");
  if (raw === undefined) return 10;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 24 * 60 ? n : 10;
}

export function staffSessionSecret(): string {
  const value = required("STAFF_SESSION_SECRET", read("STAFF_SESSION_SECRET"));
  if (Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("STAFF_SESSION_SECRET must be at least 32 bytes");
  }
  return value;
}

export function ipHashSecret(): string {
  return required("IP_HASH_SECRET", read("IP_HASH_SECRET"));
}

export function cronSecret(): string | undefined {
  return read("CRON_SECRET");
}

export interface GoogleWalletEnv {
  issuerId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

/** null when Google Wallet is not configured → noop wallet provider. */
export function googleWalletEnv(): GoogleWalletEnv | null {
  const issuerId = read("GOOGLE_WALLET_ISSUER_ID");
  const serviceAccountEmail = read("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
  const privateKey = read("GOOGLE_WALLET_PRIVATE_KEY");
  if (!issuerId || !serviceAccountEmail || !privateKey) return null;
  return { issuerId, serviceAccountEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}
