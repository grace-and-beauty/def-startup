import type { AdminPlanTag } from "@/lib/domain/admin-overview";
import { t } from "@/lib/i18n";

/** Plan name for the admin dashboard (server page and client table alike). */
export function planLabel(plan: AdminPlanTag): string {
  if (plan === "trial" || plan === "trial_over" || plan === "canceled") return t(`admin.planTag.${plan}`);
  return t(`plans.${plan}.name`);
}
