import { jwtVerify, SignJWT } from "jose";

/**
 * Staff scanner session (docs/architecture.md §4.3, §8): HS256 JWT with the
 * business and staff ids and the PIN version it was opened with, valid for
 * 12 hours. The server compares the PIN version with the staff member's
 * current PIN on every scanner call, so a PIN change ends old sessions. Pure functions — the cookie
 * handling lives in staff-cookie.ts.
 */

export const STAFF_SESSION_COOKIE = "staff_session";
export const STAFF_SESSION_TTL_SECONDS = 12 * 60 * 60;

const ISSUER = "loyalty-app";
const AUDIENCE = "staff-scanner";

export interface StaffSession {
  businessId: string;
  staffId: string;
  /** pinVersion() of the PIN hash at login (src/lib/security/pin.ts). */
  pinVersion: string;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signStaffSession(
  session: StaffSession,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ bid: session.businessId, pv: session.pinVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.staffId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + STAFF_SESSION_TTL_SECONDS)
    .sign(key(secret));
}

/** null when the token is missing, tampered with, expired or malformed. */
export async function verifyStaffSession(
  token: string | undefined,
  secret: string,
  now: Date = new Date(),
): Promise<StaffSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    const businessId = payload.bid;
    const staffId = payload.sub;
    const pinVersion = payload.pv;
    if (typeof businessId !== "string" || typeof staffId !== "string" || typeof pinVersion !== "string") {
      return null;
    }
    return { businessId, staffId, pinVersion };
  } catch {
    return null;
  }
}
