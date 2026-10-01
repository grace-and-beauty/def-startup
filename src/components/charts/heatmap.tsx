import { t, type TranslationKey } from "@/lib/i18n";

export const DOW_SHORT_KEYS: readonly TranslationKey[] = [
  "analytics.dow.1",
  "analytics.dow.2",
  "analytics.dow.3",
  "analytics.dow.4",
  "analytics.dow.5",
  "analytics.dow.6",
  "analytics.dow.7",
];

/** Visible hour span: the hours with data (padded), at least 8:00–21:00. */
function hourSpan(matrix: number[][]): [number, number] {
  let min = 8;
  let max = 21;
  for (const row of matrix) {
    row.forEach((value, hour) => {
      if (value > 0) {
        min = Math.min(min, hour);
        max = Math.max(max, hour);
      }
    });
  }
  return [min, max];
}

/** Weekday × hour heatmap (CSS grid, no client JS). matrix[dow-1][hour]. */
export function Heatmap({ matrix }: { matrix: number[][] }) {
  const [from, to] = hourSpan(matrix);
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] border-separate border-spacing-0.5 text-[10px]">
        <thead>
          <tr>
            <th scope="col" className="w-6" />
            {hours.map((hour) => (
              <th key={hour} scope="col" className="text-muted-foreground font-normal">
                {hour % 3 === 0 ? hour : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, dowIndex) => (
            <tr key={dowIndex}>
              <th scope="row" className="text-muted-foreground pr-1 text-left font-normal">
                {t(DOW_SHORT_KEYS[dowIndex])}
              </th>
              {hours.map((hour) => {
                const value = row[hour] ?? 0;
                const label = t("analytics.heatmapCell", {
                  day: t(DOW_SHORT_KEYS[dowIndex]),
                  hour,
                  count: value,
                });
                return (
                  <td key={hour} title={label} className="bg-muted h-5 rounded-sm p-0">
                    <span className="sr-only">{value}</span>
                    <span
                      aria-hidden
                      className="bg-foreground block h-full w-full rounded-sm"
                      style={{ opacity: value === 0 ? 0 : 0.15 + 0.85 * (value / max) }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
