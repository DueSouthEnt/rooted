"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Stat } from "@/components/veg/page-header";
import { Button } from "@/components/veg/ui/button";
import { ukCropName } from "@/lib/veg/crop-names";
import { addDaysISO, formatLong, formatMedium, formatWeekRange, startOfWeekMonday } from "@/lib/veg/dates";
import { combineHarvestLines, weeklyHarvest } from "@/lib/veg/planning";
import { formatNumber } from "@/lib/veg/units";
import type { PlantingView } from "@/lib/veg/views";

export function HarvestBoard({
  plantings,
  season,
  today,
  initialWeek,
}: {
  plantings: PlantingView[];
  season: number;
  today: string;
  initialWeek: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [week, setWeek] = useState(initialWeek);
  const byWeek = useMemo(
    () =>
      weeklyHarvest(
        plantings.map((planting) => ({
          ...planting,
          bedLabels: planting.beds.map((bed) => bed.label).join(", "),
        })),
      ),
    [plantings],
  );
  const weeks = [...byWeek.keys()].sort();
  const index = Math.max(0, weeks.indexOf(week));
  const selected = weeks[index] ?? week;
  const lines = byWeek.get(selected) ?? [];
  const combined = combineHarvestLines(lines);
  const totals = new Map<string, number>();
  for (const line of combined) totals.set(line.unit, (totals.get(line.unit) ?? 0) + line.amount);
  const max = Math.max(1, ...weeks.map((item) => (byWeek.get(item) ?? []).reduce((sum, line) => sum + line.amount, 0)));

  function choose(next: string) {
    setWeek(next);
    const params = new URLSearchParams();
    params.set("week", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={`Season ${season}`}
        title="Harvest forecast"
        description="Predicted yield is spread evenly across each crop's harvest window, then totaled by week. Different units stay separate."
      />
      {weeks.length === 0 ? (
        <div className="rounded-2xl border bg-card px-5 py-10 text-sm text-muted-foreground">
          No harvest is scheduled for {season}. Add plantings on the game plan and the weeks will fill in.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border bg-card p-4">
            <div className="flex h-40 items-end gap-1">
              {weeks.map((item) => {
                const amount = (byWeek.get(item) ?? []).reduce((sum, line) => sum + line.amount, 0);
                const parts = combineHarvestLines(byWeek.get(item) ?? []);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => choose(item)}
                    className={`flex w-8 shrink-0 flex-col justify-end ${item === selected ? "opacity-100" : "opacity-70"}`}
                    style={{ height: "100%" }}
                    title={`${formatWeekRange(item)} · ${formatNumber(amount, 1)}`}
                  >
                    <span className="flex w-full flex-col justify-end overflow-hidden rounded-sm" style={{ height: `${Math.max(8, (amount / max) * 100)}%` }}>
                      {parts.map((part) => (
                        <span
                          key={`${part.cropName}-${part.cultivar}-${part.unit}`}
                          style={{ flexGrow: part.amount, background: part.color, minHeight: 2 }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Each column is a week. Height follows total predicted yield, mixing units only for the shape of the season.</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Week of</p>
              <h2 className="font-display text-3xl">{formatWeekRange(selected)}</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => choose(weeks[Math.max(0, index - 1)] ?? selected)} disabled={index <= 0}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={() => choose(startOfWeekMonday(today))}>
                This week
              </Button>
              <Button variant="outline" size="icon" aria-label="Next week" onClick={() => choose(weeks[Math.min(weeks.length - 1, index + 1)] ?? selected)} disabled={index >= weeks.length - 1}>
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[...totals.entries()].map(([unit, amount]) => (
              <Stat key={unit} label={unit} value={formatNumber(amount, 1)} detail="Predicted this week" />
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="px-3 py-3 font-medium">Crop</th>
                  <th className="px-3 py-3 font-medium">Beds</th>
                  <th className="px-3 py-3 font-medium">Harvest window</th>
                  <th className="px-3 py-3 font-medium">This week</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-muted-foreground">
                      Nothing is scheduled for harvest this week.
                    </td>
                  </tr>
                ) : (
                  lines
                    .slice()
                    .sort((a, b) => b.amount - a.amount)
                    .map((line) => (
                      <tr key={`${line.plantingId}-${line.unit}`} className="border-b last:border-0">
                        <td className="px-3 py-3">
                          <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: line.color }} />
                          {ukCropName(line.cropName)} · {line.cultivar}
                        </td>
                        <td className="px-3 py-3 num">{line.bedLabels || "Unassigned"}</td>
                        <td className="px-3 py-3 num text-muted-foreground">
                          {formatMedium(selected)} – {formatMedium(addDaysISO(selected, 6))}
                        </td>
                        <td className="px-3 py-3 num">
                          {formatNumber(line.amount, 1)} {line.unit}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Window shown in the table is the forecast week, not the crop&apos;s full harvest. Full dates live on the game plan. Today is {formatLong(today)}.</p>
        </>
      )}
    </div>
  );
}
