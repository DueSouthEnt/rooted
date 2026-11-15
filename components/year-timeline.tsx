"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlantingDragSurface } from "@/components/planting-drag";
import { SowNowCard } from "@/components/sow-now";
import { addPlanting, assignPlantingBed, clearPlantingBed, shiftPlanting } from "@/lib/actions";
import { diffDays, formatDateShort } from "@/lib/dates";
import {
  clashOnBed,
  frostMarker,
  visibleInYear,
  yearBars,
  type PlantingDates,
  type SowSuggestion,
} from "@/lib/schedule";

type Grouping = "flower" | "bed";

export function YearTimeline({
  farmId,
  plantings,
  beds,
  suggestions,
  season,
  today,
  lastSpring,
  firstAutumn,
  initialGroup = "flower",
  placeId = null,
}: {
  farmId: string;
  plantings: PlantingDates[];
  beds: { id: string; name: string; blockId: string | null; blockName: string | null }[];
  suggestions: SowSuggestion[];
  season: number;
  today: string;
  lastSpring: string | null;
  firstAutumn: string | null;
  initialGroup?: Grouping;
  placeId?: string | null;
}) {
  const router = useRouter();
  const [grouping, setGrouping] = useState<Grouping>(initialGroup);
  const [flowerFilter, setFlowerFilter] = useState("All");
  const [message, setMessage] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<string | null>(placeId);
  const dragId = useRef<string | null>(null);
  const days = diffDays(`${season}-01-01`, `${season}-12-31`) + 1;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const names = ["All", ...Array.from(new Set(plantings.map((item) => item.flowerName))).sort((a, b) => a.localeCompare(b, "en-GB"))];
  const shown = plantings.filter((item) => visibleInYear(item, season) && (flowerFilter === "All" || item.flowerName === flowerFilter));
  const unassigned = shown.filter((item) => !item.bedId);
  const todayLeft = today.startsWith(String(season)) ? (diffDays(`${season}-01-01`, today) / days) * 100 : null;
  const springLeft = lastSpring ? frostMarker(lastSpring, season) : null;
  const autumnLeft = firstAutumn ? frostMarker(firstAutumn, season) : null;

  const rows = useMemo(() => bedRows(beds), [beds]);

  function paint(id: string | null) {
    const planting = id?.startsWith("sow:")
      ? suggestionDates(suggestions.find((item) => item.flower.slug === id.slice(4)))
      : plantings.find((item) => item.id === id);
    document.querySelectorAll<HTMLElement>("[data-bed-id], [data-block-id]").forEach((row) => row.classList.remove("bed-free", "bed-clash"));
    if (!planting) return;
    const end = planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd;
    for (const row of rows) {
      const bedId = row.bedId ?? firstFree(row.memberIds, planting, end);
      const node = document.querySelector<HTMLElement>(row.bedId ? `[data-bed-id="${row.bedId}"]` : `[data-block-id="${row.blockId}"]`);
      if (!node) continue;
      const target = bedId ?? row.memberIds[0];
      const clash = target ? clashOnBed(plantings, target, planting.fieldDate, end, planting.id) : null;
      node.classList.add(!target || clash ? "bed-clash" : "bed-free");
    }
  }

  async function dropOn(id: string, point: { x: number; y: number }) {
    paint(null);
    const hit = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>("[data-bed-id], [data-block-id]");
    const row = rows.find((item) => (item.bedId && item.bedId === hit?.dataset.bedId) || (item.blockId && item.blockId === hit?.dataset.blockId));
    if (!row) {
      setMessage("Drop it on a bed row.");
      return;
    }
    const suggestion = id.startsWith("sow:") ? suggestions.find((item) => item.flower.slug === id.slice(4)) : null;
    const dates = suggestion ? suggestionDates(suggestion) : plantings.find((item) => item.id === id);
    if (!dates) return;
    const end = dates.liftDate && dates.liftDate > dates.bloomEnd ? dates.liftDate : dates.bloomEnd;
    const bedId = row.bedId ?? firstFree(row.memberIds, dates, end);
    if (!bedId) {
      setMessage(`${row.label} is full for those dates.`);
      return;
    }
    const result = suggestion
      ? await addPlanting(farmId, {
          flowerSlug: suggestion.flower.slug,
          variety: suggestion.window.variety,
          method: suggestion.window.method,
          nurseryStart: suggestion.window.nurseryStart,
          fieldDate: suggestion.window.fieldDate,
          bloomStart: suggestion.window.bloomStart,
          bloomEnd: suggestion.window.bloomEnd,
          liftDate: suggestion.window.liftDate,
          firstBloomYear: suggestion.window.firstBloomYear,
          spansYears: suggestion.window.spansYears,
          bedId,
        })
      : await assignPlantingBed(farmId, id, bedId);
    if ("error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(null);
    router.refresh();
  }

  const picking = plantings.find((item) => item.id === pickerId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Year plan</p>
          <h1 className="font-heading text-4xl">{season}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sage is under cover, sand is in the bed, blush is in flower. A dashed bar is a perennial still settling. Drag a bar sideways to move the whole run.
          </p>
        </div>
      </div>
      <SowNowCard
        farmId={farmId}
        suggestions={suggestions}
        draggable
        onDragStart={(id) => {
          dragId.current = id;
          setGrouping("bed");
          paint(id);
        }}
        onDragEnd={() => paint(null)}
        onDrop={(id, point) => void dropOn(id, point)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setGrouping("flower")} className={grouping === "flower" ? "h-9 rounded-full bg-primary px-3 text-sm text-primary-foreground" : "h-9 rounded-full border border-border bg-card px-3 text-sm"}>
          By flower
        </button>
        <button type="button" onClick={() => setGrouping("bed")} className={grouping === "bed" ? "h-9 rounded-full bg-primary px-3 text-sm text-primary-foreground" : "h-9 rounded-full border border-border bg-card px-3 text-sm"}>
          By bed
        </button>
        <select aria-label="Filter by flower" value={flowerFilter} onChange={(event) => setFlowerFilter(event.target.value)} className="h-9 rounded-full border border-input bg-card px-3 text-sm">
          {names.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <ul className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-[#e7f0e4]" /> Sow</li>
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-[#f3e0c8]" /> In the bed</li>
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-[#e7b7c6]" /> In flower</li>
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-[#c45b86]" /> Lift</li>
        </ul>
      </div>
      {message ? <p data-testid="assign-message" className="rounded-xl bg-accent px-3 py-2 text-sm">{message}</p> : null}
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-border bg-card p-3" data-testid="unassigned-list">
          <p className="font-heading text-xl">Not on a bed yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Drag onto a free bed. The bed is busy from plant-out until the last cut, or all year for a perennial.</p>
          <ul className="mt-3 space-y-2">
            {unassigned.map((planting) => (
              <li key={planting.id}>
                <PlantingDragSurface
                  id={planting.id}
                  label={planting.flowerName}
                  detail={`${planting.variety} · plant ${formatDateShort(planting.fieldDate)}`}
                  testId={`unassigned-${planting.id}`}
                  onDragStart={(id) => {
                    dragId.current = id;
                    setGrouping("bed");
                    paint(id);
                  }}
                  onDragEnd={() => paint(null)}
                  onDrop={(id, point) => void dropOn(id, point)}
                  onActivate={(id) => {
                    setGrouping("bed");
                    setPickerId(id);
                  }}
                />
              </li>
            ))}
            {unassigned.length === 0 ? <li className="text-sm text-muted-foreground">Every planting in view has a bed.</li> : null}
          </ul>
        </aside>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[190px_minmax(0,1fr)] border-b">
              <div />
              <div className="flex">
                {months.map((month) => (
                  <div key={month} className="w-[8.333%] border-l px-1 py-1 text-[11px] text-muted-foreground">
                    {month}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative" data-testid="year-track">
              {todayLeft != null ? <Marker left={todayLeft} className="bg-primary" label="Today" /> : null}
              {springLeft != null ? <Marker left={springLeft} className="bg-[#7f9a86]" label="Last frost" /> : null}
              {autumnLeft != null ? <Marker left={autumnLeft} className="bg-[#d9899a]" label="First frost" /> : null}
              {grouping === "flower" ? (
                <FlowerRows
                  plantings={shown}
                  season={season}
                  onOpen={(id) => setPickerId(id)}
                  onShift={(id, days) => void shift(id, days)}
                />
              ) : (
                <BedView rows={rows} plantings={shown} season={season} onOpen={(id) => setPickerId(id)} onShift={(id, days) => void shift(id, days)} />
              )}
            </div>
          </div>
        </div>
      </div>
      {picking ? (
        <div className="rounded-2xl border border-border bg-card p-4" data-testid="put-on-bed">
          <p className="font-heading text-2xl">Put {picking.flowerName} on a bed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The bed is needed from {formatDateShort(picking.fieldDate)} until {formatDateShort(picking.liftDate && picking.liftDate > picking.bloomEnd ? picking.liftDate : picking.bloomEnd)}. Time under cover does not use a bed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rows.map((row) => {
              const end = picking.liftDate && picking.liftDate > picking.bloomEnd ? picking.liftDate : picking.bloomEnd;
              const bedId = row.bedId ?? firstFree(row.memberIds, picking, end);
              const free = Boolean(bedId) && !clashOnBed(plantings, bedId!, picking.fieldDate, end, picking.id);
              return (
                <button
                  key={row.key}
                  type="button"
                  disabled={!free}
                  onClick={() => bedId && void place(picking.id, bedId)}
                  className="h-9 rounded-full border border-border px-3 text-sm disabled:opacity-40"
                >
                  {row.label}
                  {free ? "" : " · busy"}
                </button>
              );
            })}
            {picking.bedId ? (
              <button type="button" className="h-9 rounded-full px-3 text-sm underline" onClick={() => void clear(picking.id)}>
                Take it off the bed
              </button>
            ) : null}
            <button type="button" className="h-9 rounded-full px-3 text-sm" onClick={() => setPickerId(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  async function shift(id: string, days: number) {
    const result = await shiftPlanting(farmId, id, days);
    if ("error" in result && result.error) setMessage(result.error);
    else {
      setMessage(null);
      router.refresh();
    }
  }

  async function place(id: string, bedId: string) {
    const result = await assignPlantingBed(farmId, id, bedId);
    if ("error" in result && result.error) setMessage(result.error);
    else {
      setMessage(null);
      setPickerId(null);
      router.refresh();
    }
  }

  async function clear(id: string) {
    const result = await clearPlantingBed(farmId, id);
    if ("error" in result && result.error) setMessage(result.error);
    else router.refresh();
  }

  function firstFree(memberIds: string[], planting: PlantingDates, end: string): string | null {
    return memberIds.find((bedId) => !clashOnBed(plantings, bedId, planting.fieldDate, end, planting.id)) ?? null;
  }
}

function Marker({ left, className, label }: { left: number; className: string; label: string }) {
  return (
    <div className={`pointer-events-none absolute top-0 bottom-0 z-10 w-px ${className}`} style={{ left: `calc(190px + (100% - 190px) * ${left / 100})` }}>
      <span className="absolute top-0 left-1 text-[10px] whitespace-nowrap text-muted-foreground">{label}</span>
    </div>
  );
}

function FlowerRows({
  plantings,
  season,
  onOpen,
  onShift,
}: {
  plantings: PlantingDates[];
  season: number;
  onOpen: (id: string) => void;
  onShift: (id: string, days: number) => void;
}) {
  const groups = new Map<string, PlantingDates[]>();
  for (const planting of plantings) {
    const list = groups.get(planting.flowerName) ?? [];
    list.push(planting);
    groups.set(planting.flowerName, list);
  }
  return (
    <div>
      {[...groups.entries()].map(([name, rows]) => (
        <div key={name}>
          <div className="bg-secondary/50 px-3 py-1 text-xs tracking-wide text-muted-foreground uppercase">{name}</div>
          {rows.map((planting) => (
            <div key={planting.id} className="grid grid-cols-[190px_minmax(0,1fr)] border-t">
              <button type="button" className="px-3 py-2 text-left text-sm" onClick={() => onOpen(planting.id)}>
                <span className="block">{planting.variety || planting.flowerName}</span>
                <span className="text-xs text-muted-foreground">{planting.bedId ? "On a bed" : "No bed"} · drag the bar to shift</span>
              </button>
              <Bars planting={planting} season={season} onShift={(days) => onShift(planting.id, days)} />
            </div>
          ))}
        </div>
      ))}
      {plantings.length === 0 ? <p className="px-3 py-6 text-sm text-muted-foreground">Nothing on the year yet. Add one from the list above.</p> : null}
    </div>
  );
}

function BedView({
  rows,
  plantings,
  season,
  onOpen,
  onShift,
}: {
  rows: BedRow[];
  plantings: PlantingDates[];
  season: number;
  onOpen: (id: string) => void;
  onShift: (id: string, days: number) => void;
}) {
  return (
    <div data-testid="bed-view">
      {rows.map((row) => {
        const here = plantings.filter((planting) => planting.bedId && row.memberIds.includes(planting.bedId));
        return (
          <div
            key={row.key}
            data-bed-id={row.bedId ?? undefined}
            data-block-id={row.blockId ?? undefined}
            data-testid={row.bedId ? `bed-row-${row.bedId}` : `block-row-${row.blockId}`}
            className="grid grid-cols-[190px_minmax(0,1fr)] border-t"
            onDragOver={(event) => event.preventDefault()}
          >
            <div className="px-3 py-2 text-sm">
              <span className="block">{row.label}</span>
              <span className="text-xs text-muted-foreground">{here.map((item) => item.flowerName).join(", ") || "Empty"}</span>
            </div>
            <div className="relative min-h-9">
              {here.map((planting) => (
                <Bars key={planting.id} planting={planting} season={season} onOpen={() => onOpen(planting.id)} onShift={(days) => onShift(planting.id, days)} />
              ))}
            </div>
          </div>
        );
      })}
      {rows.length === 0 ? <p className="px-3 py-6 text-sm text-muted-foreground">Draw a bed on the map first. Then the year has somewhere to land.</p> : null}
    </div>
  );
}

function Bars({
  planting,
  season,
  onShift,
  onOpen,
}: {
  planting: PlantingDates;
  season: number;
  onShift: (days: number) => void;
  onOpen?: () => void;
}) {
  const bars = yearBars(planting, season);
  const start = useRef<{ x: number; width: number } | null>(null);
  const [preview, setPreview] = useState(0);
  return (
    <div
      className="relative h-8"
      title={`${planting.flowerName} · ${planting.variety}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const width = event.currentTarget.getBoundingClientRect().width;
        start.current = { x: event.clientX, width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        const days = Math.round(((event.clientX - start.current.x) / start.current.width) * 365);
        setPreview(days);
      }}
      onPointerUp={() => {
        const days = preview;
        start.current = null;
        setPreview(0);
        if (Math.abs(days) >= 1) onShift(days);
        else onOpen?.();
      }}
    >
      <span className="absolute inset-y-1" style={{ left: `${preview * (100 / 365)}%`, right: `${-preview * (100 / 365)}%` }}>
        {bars.establishing ? <BarSpan tone="establish" box={bars.establishing} /> : null}
        {bars.nursery ? <BarSpan tone="nursery" box={bars.nursery} /> : null}
        {bars.growing ? <BarSpan tone="grow" box={bars.growing} /> : null}
        {bars.bloom ? <BarSpan tone="bloom" box={bars.bloom} /> : null}
        {bars.lift ? <BarSpan tone="lift" box={bars.lift} /> : null}
      </span>
    </div>
  );
}

function BarSpan({ tone, box }: { tone: "nursery" | "grow" | "bloom" | "lift" | "establish"; box: { left: number; width: number } }) {
  const colour =
    tone === "nursery" ? "bg-[#e7f0e4]" : tone === "grow" ? "bg-[#f3e0c8]" : tone === "bloom" ? "bg-[#e7b7c6]" : tone === "lift" ? "bg-[#c45b86]" : "bg-[repeating-linear-gradient(90deg,#e7f0e4_0_6px,transparent_6px_10px)]";
  return <span className={`absolute top-0 h-full rounded-sm ${colour}`} style={{ left: `${box.left}%`, width: `${box.width}%` }} />;
}

type BedRow = { key: string; label: string; bedId: string | null; blockId: string | null; memberIds: string[] };

function bedRows(beds: { id: string; name: string; blockId: string | null; blockName: string | null }[]): BedRow[] {
  const rows: BedRow[] = [];
  for (const bed of beds.filter((item) => !item.blockId)) {
    rows.push({ key: bed.id, label: bed.name, bedId: bed.id, blockId: null, memberIds: [bed.id] });
  }
  const blocks = new Map<string, { name: string; ids: string[] }>();
  for (const bed of beds.filter((item) => item.blockId)) {
    const current = blocks.get(bed.blockId!) ?? { name: bed.blockName || "Block", ids: [] };
    current.ids.push(bed.id);
    blocks.set(bed.blockId!, current);
  }
  for (const [blockId, block] of blocks) {
    if (block.ids.length <= 12) {
      block.ids.forEach((id, index) => {
        const bed = beds.find((item) => item.id === id);
        rows.push({ key: id, label: bed?.name ?? `${block.name} ${index + 1}`, bedId: id, blockId: null, memberIds: [id] });
      });
    } else {
      rows.push({ key: blockId, label: `${block.name} · next free of ${block.ids.length}`, bedId: null, blockId, memberIds: block.ids });
    }
  }
  return rows;
}

function suggestionDates(suggestion: SowSuggestion | undefined): PlantingDates | null {
  if (!suggestion) return null;
  return {
    id: `sow:${suggestion.flower.slug}`,
    flowerSlug: suggestion.flower.slug,
    flowerName: suggestion.flower.commonName,
    colour: suggestion.flower.colour,
    variety: suggestion.window.variety,
    method: suggestion.window.method,
    nurseryStart: suggestion.window.nurseryStart,
    fieldDate: suggestion.window.fieldDate,
    bloomStart: suggestion.window.bloomStart,
    bloomEnd: suggestion.window.bloomEnd,
    liftDate: suggestion.window.liftDate,
    firstBloomYear: suggestion.window.firstBloomYear,
    spansYears: suggestion.window.spansYears,
    bedId: null,
  };
}
