import { jwtVerify, SignJWT } from "jose";

/**
 * Staff scanner session (docs/architecture.md §4.3, §8): HS256 JWT with the
 * business and staff ids, valid for 12 hours. Pure functions — the cookie
 * handling lives in staff-cookie.ts.
 */

export const STAFF_SESSION_COOKIE = "staff_session";
export const STAFF_SESSION_TTL_SECONDS = 12 * 60 * 60;

const ISSUER = "loyalty-app";
const AUDIENCE = "staff-scanner";

export interface StaffSession {
  businessId: string;
  staffId: string;
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
  return new SignJWT({ bid: session.businessId })
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
    if (typeof businessId !== "string" || typeof staffId !== "string") return null;
    return { businessId, staffId };
  } catch {
    return null;
  }
}
