"use client";

import { useMemo, useState } from "react";
import { addDays, formatDateShort, startOfWeekMonday } from "@/lib/dates";
import { visibleInYear, type PlantingDates } from "@/lib/schedule";

export function HarvestBoard({
  plantings,
  season,
  today,
  bedNames,
}: {
  plantings: PlantingDates[];
  season: number;
  today: string;
  bedNames: Record<string, string>;
}) {
  const weeks = useMemo(() => weeksInFlower(plantings, season), [plantings, season]);
  const keys = [...weeks.keys()];
  const initial = startOfWeekMonday(today);
  const startAt = keys.find((week) => week >= initial) ?? keys[0] ?? initial;
  const [week, setWeek] = useState(startAt);
  const index = Math.max(0, keys.indexOf(week));
  const selected = keys[index] ?? week;
  const lines = weeks.get(selected) ?? [];
  const max = Math.max(1, ...keys.map((item) => weeks.get(item)?.length ?? 0));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Harvest · {season}</p>
        <h1 className="font-heading text-4xl">What is in flower</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Each column is a Monday week. Height is how many plantings are in flower, not a promise of bucket-loads.
        </p>
      </div>
      {keys.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-sm text-muted-foreground">
          No blooms are dated for {season}. Add a planting on the game plan and the weeks fill in.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card p-4">
            <div className="flex h-36 items-end gap-1">
              {keys.map((item) => {
                const count = weeks.get(item)?.length ?? 0;
                return (
                  <button key={item} type="button" onClick={() => setWeek(item)} className="flex w-8 shrink-0 flex-col justify-end" style={{ height: "100%" }} title={formatDateShort(item)}>
                    <span className="w-full rounded-sm bg-[#e7b7c6]" style={{ height: `${Math.max(8, (count / max) * 100)}%`, opacity: item === selected ? 1 : 0.55 }} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-heading text-3xl">Week of {formatDateShort(selected)}</h2>
            <div className="flex gap-2">
              <button type="button" className="h-9 rounded-full border border-border px-3 text-sm" disabled={index <= 0} onClick={() => setWeek(keys[index - 1] ?? selected)}>
                Previous
              </button>
              <button type="button" className="h-9 rounded-full border border-border px-3 text-sm" onClick={() => setWeek(startAt)}>
                This week
              </button>
              <button type="button" className="h-9 rounded-full border border-border px-3 text-sm" disabled={index >= keys.length - 1} onClick={() => setWeek(keys[index + 1] ?? selected)}>
                Next
              </button>
            </div>
          </div>
          <ul className="space-y-2">
            {lines.length === 0 ? <li className="text-sm text-muted-foreground">Nothing is in flower this week.</li> : null}
            {lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <span>
                  <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: line.colour }} />
                  {line.flowerName}
                  {line.variety ? ` · ${line.variety}` : ""}
                </span>
                <span className="text-muted-foreground">{line.bedId ? bedNames[line.bedId] ?? "On a bed" : "No bed yet"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function weeksInFlower(plantings: PlantingDates[], season: number): Map<string, PlantingDates[]> {
  const weeks = new Map<string, PlantingDates[]>();
  for (const planting of plantings) {
    if (!visibleInYear(planting, season) || season < planting.firstBloomYear) continue;
    const start = planting.spansYears ? `${season}-${planting.bloomStart.slice(5)}` : planting.bloomStart;
    const end = planting.spansYears ? `${season}-${planting.bloomEnd.slice(5)}` : planting.bloomEnd;
    if (end < `${season}-01-01` || start > `${season}-12-31`) continue;
    let cursor = startOfWeekMonday(start < `${season}-01-01` ? `${season}-01-01` : start);
    const last = startOfWeekMonday(end > `${season}-12-31` ? `${season}-12-31` : end);
    while (cursor <= last) {
      const list = weeks.get(cursor) ?? [];
      list.push(planting);
      weeks.set(cursor, list);
      cursor = addDays(cursor, 7);
    }
  }
  return new Map([...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
