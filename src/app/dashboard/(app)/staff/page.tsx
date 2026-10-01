import type { Metadata } from "next";

import { LockedFeature, PageHeader, Section } from "@/components/dashboard/blocks";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { requireOwnerContext } from "@/lib/auth/owner";
import { listStaff } from "@/lib/data";
import { getLimit, hasFeature } from "@/lib/domain/plans";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";

import { addStaff, changeStaffPin, setStaffActive } from "./actions";
import { AddStaffForm, StaffRowActions } from "./staff-forms";

export const metadata: Metadata = { title: t("staff.title") };

export default async function StaffPage() {
  const { supabase, business } = await requireOwnerContext();
  const now = new Date();
  const staff = await listStaff(supabase, business.id);
  const pinsAllowed = hasFeature(business, "staff_pins", now);
  const limit = getLimit(business, "staff", now);
  const activeCount = staff.filter((s) => s.is_active).length;
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

      <Section title={t("staff.title")}>
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
    </>
  );
}
