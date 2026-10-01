"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { t } from "@/lib/i18n";

export interface DailyVisitsPoint {
  label: string;
  newVisits: number;
  repeatVisits: number;
}

/** Stacked bars: first visits («нові») vs repeat visits («постійні») per day. */
export function DailyVisitsChart({ data }: { data: DailyVisitsPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            minTickGap={16}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={40}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="repeatVisits"
            name={t("analytics.repeatShort")}
            stackId="visits"
            fill="var(--chart-1)"
            isAnimationActive={false}
          />
          <Bar
            dataKey="newVisits"
            name={t("analytics.newVisits")}
            stackId="visits"
            fill="var(--chart-4)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
