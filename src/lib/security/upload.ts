/**
 * Logo upload checks (docs/architecture.md §8): only PNG / JPEG / WebP,
 * ≤ 1 MB, and the file content must match the declared type (magic bytes),
 * so a renamed HTML/SVG file can't end up in the public bucket. Pure.
 */

export const LOGO_MAX_BYTES = 1024 * 1024;

export const LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export type LogoMimeType = keyof typeof LOGO_TYPES;

export function isLogoMimeType(value: string): value is LogoMimeType {
  return Object.prototype.hasOwnProperty.call(LOGO_TYPES, value);
}

/** Cheap pre-check (also used in the browser before uploading). */
export function isAcceptableLogo(file: { type: string; size: number }): boolean {
  return isLogoMimeType(file.type) && file.size > 0 && file.size <= LOGO_MAX_BYTES;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

/** Detects the real image type from the first bytes; null when unknown. */
export function sniffImageType(bytes: Uint8Array): LogoMimeType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // "RIFF" .... "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export type LogoCheck = { ok: true; type: LogoMimeType; extension: string } | { ok: false };

export function checkLogo(declaredType: string, bytes: Uint8Array): LogoCheck {
  if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return { ok: false };
  const sniffed = sniffImageType(bytes);
  if (!sniffed || sniffed !== declaredType) return { ok: false };
  return { ok: true, type: sniffed, extension: LOGO_TYPES[sniffed] };
}
