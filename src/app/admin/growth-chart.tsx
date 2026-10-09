import type { AdminWeek } from "@/lib/domain/admin-overview";
import { t } from "@/lib/i18n";

const W = 1000;
const H = 260;
const L = 44;
const R = 36;
const T = 10;
const B = 28;

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}.${month}`;
}

/** Bars: new cards per week (left scale); line: new businesses (right scale). */
export function GrowthChart({ weeks }: { weeks: readonly AdminWeek[] }) {
  if (weeks.length === 0) return null;
  const cardsMax = niceMax(Math.max(...weeks.map((w) => w.new_cards)));
  const bizMax = niceMax(Math.max(...weeks.map((w) => w.new_businesses)));
  const plotH = H - T - B;
  const cw = (W - L - R) / weeks.length;
  const y = (value: number, max: number) => T + plotH * (1 - value / max);
  const line = weeks.map((w, i) => `${L + i * cw + cw / 2},${y(w.new_businesses, bizMax)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("admin.growthHint")}>
      {[0, 1, 2, 3].map((i) => {
        const gy = T + plotH * (1 - i / 3);
        return (
          <g key={i} className="fill-muted-foreground text-[11px]">
            <line x1={L} x2={W - R} y1={gy} y2={gy} className="stroke-border" />
            <text x={L - 8} y={gy + 4} textAnchor="end">
              {Math.round((cardsMax * i) / 3)}
            </text>
            <text x={W - R + 8} y={gy + 4}>
              {Math.round((bizMax * i) / 3)}
            </text>
          </g>
        );
      })}
      {weeks.map((w, i) => {
        const x = L + i * cw + cw * 0.18;
        const bw = cw * 0.64;
        const h = (plotH * w.new_cards) / cardsMax;
        return (
          <g key={w.week_start}>
            <rect x={x} y={H - B - h} width={bw} height={h} rx={5} className="fill-foreground">
              <title>
                {t("admin.growthPoint", {
                  week: shortDate(w.week_start),
                  cards: w.new_cards,
                  businesses: w.new_businesses,
                })}
              </title>
            </rect>
            {i % 2 === 0 ? (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {shortDate(w.week_start)}
              </text>
            ) : null}
          </g>
        );
      })}
      <polyline points={line} fill="none" strokeWidth={3} strokeLinejoin="round" className="stroke-chart-4" />
      {weeks.map((w, i) => (
        <circle
          key={w.week_start}
          cx={L + i * cw + cw / 2}
          cy={y(w.new_businesses, bizMax)}
          r={4.5}
          strokeWidth={2}
          className="fill-background stroke-chart-3"
        />
      ))}
    </svg>
  );
}
