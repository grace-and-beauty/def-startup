import "server-only";

import { randomUUID } from "node:crypto";

import { checkLogo } from "@/lib/security/upload";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

export const LOGO_BUCKET = "logos";

export type LogoUploadResult =
  | { status: "ok"; url: string }
  | { status: "invalid" }
  | { status: "unavailable" };

/**
 * Validates and uploads a business logo to Storage under
 * logos/{businessId}/<random>.<ext> (service role; the caller must have
 * verified that the signed-in owner owns businessId).
 */
export async function uploadBusinessLogo(businessId: string, file: File): Promise<LogoUploadResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkLogo(file.type, bytes);
  if (!check.ok) return { status: "invalid" };

  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return { status: "unavailable" };

  const path = `${businessId}/${randomUUID()}.${check.extension}`;
  const { error } = await admin.storage.from(LOGO_BUCKET).upload(path, bytes, {
    contentType: check.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("uploadBusinessLogo failed", error.message);
    return { status: "unavailable" };
  }
  const { data } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return { status: "ok", url: data.publicUrl };
}

/** Best-effort removal of a previous logo of the same business. */
export async function removeBusinessLogo(businessId: string, logoUrl: string | null): Promise<void> {
  if (!logoUrl) return;
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`;
  const index = logoUrl.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(logoUrl.slice(index + marker.length).split("?")[0] ?? "");
  // Never touch files outside this business' folder.
  if (!path.startsWith(`${businessId}/`) || path.includes("..")) return;
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.storage.from(LOGO_BUCKET).remove([path]);
  if (error) console.error("removeBusinessLogo failed", error.message);
}
