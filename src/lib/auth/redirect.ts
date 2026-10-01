/**
 * Validates a post-login redirect target. Only same-site absolute paths are
 * allowed ("/dashboard", "/dashboard/onboarding?niche=…"); everything else
 * (other hosts, protocol-relative "//evil", backslashes) falls back.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
