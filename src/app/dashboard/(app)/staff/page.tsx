import type { Metadata } from "next";

import { LockedFeature, PageHeader, Section } from "@/components/dashboard/blocks";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { requireOwnerContext } from "@/lib/auth/owner";
import { listActivity, listStaff } from "@/lib/data";
import { getLimit, hasFeature, scannerStaffLimit, usableStaff } from "@/lib/domain/plans";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";

import { addStaff, changeStaffPin, setStaffActive } from "./actions";
import { AddStaffForm, StaffRowActions } from "./staff-forms";

export const metadata: Metadata = { title: t("staff.title") };

/** Last scanner actions shown to the owner (all of them: CSV on the clients page). */
const ACTIVITY_ROWS = 30;

function activityTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(iso),
  );
}

export default async function StaffPage() {
  const { supabase, business } = await requireOwnerContext();
  const now = new Date();
  const [staff, activity] = await Promise.all([
    listStaff(supabase, business.id),
    listActivity(supabase, business.id, ACTIVITY_ROWS),
  ]);
  const pinsAllowed = hasFeature(business, "staff_pins", now);
  const limit = getLimit(business, "staff", now);
  const activeCount = staff.filter((s) => s.is_active).length;
  const usableIds = new Set(usableStaff(staff, business, now).map((s) => s.id));
  const outsidePlan = staff.some((s) => s.is_active && !usableIds.has(s.id));
  const scanUrl = `${siteUrl()}/scan/${business.slug}`;

  return (
    <>
      <PageHeader title={t("staff.title")} />

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <span className="text-sm">{t("staff.intro")}</span>
        <span className="font-mono text-sm break-all">{scanUrl}</span>
        <div>
          <CopyButton value={scanUrl} />
        </div>
      </div>

      <Section
        title={t("staff.title")}
        hint={outsidePlan ? t("staff.notInPlanHint", { count: scannerStaffLimit(business, now) }) : undefined}
      >
        <ul className="flex flex-col divide-y">
          {staff.map((member) => (
            <li
              key={member.id}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{member.name}</span>
                  <Badge variant={member.is_active ? "default" : "secondary"}>
                    {member.is_active ? t("staff.active") : t("staff.inactive")}
                  </Badge>
                  {member.is_active && !usableIds.has(member.id) ? (
                    <Badge variant="destructive">{t("staff.notInPlan")}</Badge>
                  ) : null}
                </div>
                <span className="text-muted-foreground text-xs">
                  {t("staff.since", { date: formatDate(member.created_at, business.timezone) })}
                </span>
              </div>
              <StaffRowActions
                name={member.name}
                isActive={member.is_active}
                toggleAction={setStaffActive.bind(null, member.id, !member.is_active)}
                pinAction={changeStaffPin.bind(null, member.id)}
              />
            </li>
          ))}
        </ul>
      </Section>

      {pinsAllowed ? (
        <Section
          title={t("staff.addTitle")}
          hint={activeCount >= limit ? t("staff.limitReached", { limit }) : undefined}
        >
          <AddStaffForm action={addStaff} />
        </Section>
      ) : (
        <LockedFeature title={t("staff.lockedTitle")} text={t("staff.lockedText")} />
      )}

      <Section title={t("staff.activityTitle")} hint={t("staff.activityHint")}>
        {activity.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("staff.activityEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {activity.map((event) => (
              <li key={event.id} className="grid grid-cols-[auto_1fr] gap-x-3 py-2 first:pt-0 last:pb-0 sm:grid-cols-[9rem_10rem_1fr_auto]">
                <span className="text-muted-foreground tabular-nums">{activityTime(event.createdAt, business.timezone)}</span>
                <span className={event.type === "stamp" ? "" : "text-success font-medium"}>
                  {event.type === "stamp" ? t("staff.activityStamp") : t("staff.activityReward")}
                </span>
                <span className="col-span-2 truncate sm:col-span-1">{event.customerName ?? t("clients.noName")}</span>
                <span className="text-muted-foreground col-span-2 truncate sm:col-span-1 sm:text-right">
                  {event.staffName ?? t("staff.activityNoStaff")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
