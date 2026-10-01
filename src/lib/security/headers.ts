/**
 * HTTP security headers (docs/architecture.md §8), applied to every route in
 * next.config.ts. Pure and dependency-free so next.config can import it and
 * unit tests can check it.
 *
 * CSP is the "basic" variant from the Next.js guide (no nonces): nonces would
 * force dynamic rendering of every page, including the static landing pages.
 * 'unsafe-inline' stays for scripts (Next.js inline bootstrap) and styles
 * (card colors are inline styles). Everything else is locked to 'self':
 * no plugins, no <base> hijacking, forms post only to us, no framing.
 */

export interface SecurityHeaderOptions {
  /** next dev: React needs 'unsafe-eval', HMR needs websockets. */
  isDev: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL — logos are served from its Storage. */
  supabaseUrl?: string;
  /** NEXT_PUBLIC_SITE_URL — upgrade-insecure-requests only when it is https. */
  siteUrl?: string;
}

export interface HeaderEntry {
  key: string;
  value: string;
}

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ isDev, supabaseUrl, siteUrl }: SecurityHeaderOptions): string {
  const supabase = origin(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const https = origin(siteUrl)?.startsWith("https:") ?? false;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(supabase ? [supabase] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...(supabase ? [supabase] : []),
      ...(supabaseWs ? [supabaseWs] : []),
      ...(isDev ? ["ws:"] : []),
    ],
    // Scanner camera stream (MediaStream) and decoded frames.
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "manifest-src": ["'self'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (https && !isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions): HeaderEntry[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Camera only for our own pages (staff scanner); everything else off.
    {
      key: "Permissions-Policy",
      value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
