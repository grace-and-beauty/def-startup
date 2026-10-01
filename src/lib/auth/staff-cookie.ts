import "server-only";

import { cookies } from "next/headers";

import { MissingEnvError, staffSessionSecret } from "@/lib/env";

import {
  signStaffSession,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_TTL_SECONDS,
  verifyStaffSession,
  type StaffSession,
} from "./staff-session";

const COOKIE_PATH = "/scan";

function secretOrNull(): string | null {
  try {
    return staffSessionSecret();
  } catch (error) {
    if (error instanceof MissingEnvError) return null;
    throw error;
  }
}

export function isStaffSessionConfigured(): boolean {
  return secretOrNull() !== null;
}

/** Verified session from the request cookie, or null. */
export async function readStaffSession(): Promise<StaffSession | null> {
  const secret = secretOrNull();
  if (!secret) return null;
  const store = await cookies();
  return verifyStaffSession(store.get(STAFF_SESSION_COOKIE)?.value, secret);
}

/** Server Actions / Route Handlers only. */
export async function setStaffSession(session: StaffSession): Promise<void> {
  const token = await signStaffSession(session, staffSessionSecret());
  const store = await cookies();
  store.set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: STAFF_SESSION_TTL_SECONDS,
  });
}

/** Server Actions / Route Handlers only. */
export async function clearStaffSession(): Promise<void> {
  const store = await cookies();
  store.set(STAFF_SESSION_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
}
