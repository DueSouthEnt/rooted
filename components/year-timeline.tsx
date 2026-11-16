"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlantingDialog } from "@/components/planting-dialog";
import { PlantingDragSurface } from "@/components/planting-drag";
import { addPlanting, assignPlantingBeds, shiftPlanting } from "@/lib/actions";
import { diffDays, formatDateShort } from "@/lib/dates";
import type { Flower } from "@/lib/flower";
import { assignedBeds, bedsEmptyInMonth, bedWeekUtilisation, consecutiveBeds, freeBedIds, longestOpenGap } from "@/lib/occupancy";
import { frostMarker, shiftDates, yearBars, type FlowerWindow, type PlantingDates, type SowSuggestion } from "@/lib/schedule";
import type { SitePlan } from "@/lib/tasks";

export function YearTimeline({
  farmId,
  plantings,
  beds,
  suggestions,
  quickCrops,
  flowers,
  site,
  season,
  today,
  lastSpring,
  firstAutumn,
}: {
  farmId: string;
  plantings: PlantingDates[];
  beds: { id: string; name: string; blockId: string | null; blockName: string | null; blockIndex: number | null }[];
  suggestions: SowSuggestion[];
  quickCrops: { name: string; slug: string; days: number; window: FlowerWindow }[];
  flowers: Flower[];
  site: SitePlan | null;
  season: number;
  today: string;
  lastSpring: string | null;
  firstAutumn: string | null;
}) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const dragPaint = useRef<{ free: Set<string>; hover: string | null; frame: number; point: { x: number; y: number } | null } | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PlantingDates | null | "new">(null);
  const days = diffDays(`${season}-01-01`, `${season}-12-31`) + 1;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const todayLeft = today.startsWith(String(season)) ? (diffDays(`${season}-01-01`, today) / days) * 100 : null;
  const springLeft = lastSpring ? frostMarker(lastSpring, season) : null;
  const autumnLeft = firstAutumn ? frostMarker(firstAutumn, season) : null;
  const groups = useMemo(() => groupBeds(beds), [beds]);
  const bedIds = useMemo(() => beds.map((bed) => bed.id), [beds]);
  const byBed = useMemo(() => plantingsByBed(plantings), [plantings]);
  const use = useMemo(() => bedWeekUtilisation(bedIds, plantings, season), [bedIds, plantings, season]);
  const month = today.startsWith(String(season)) ? Number(today.slice(5, 7)) : 6;
  const emptyMonth = useMemo(() => bedsEmptyInMonth(bedIds, plantings, season, month), [bedIds, plantings, season, month]);
  const gap = useMemo(
    () => longestOpenGap(bedIds, plantings, season, today.startsWith(String(season)) ? today : `${season}-03-01`),
    [bedIds, plantings, season, today],
  );
  const quick = gap ? quickCrops.filter((crop) => crop.days <= gap.days && crop.days >= 21).sort((a, b) => a.days - b.days)[0] : null;
  const gapBed = beds.find((bed) => bed.id === gap?.bedId);
  const unassigned = useMemo(() => plantings.filter((item) => assignedBeds(item).length === 0), [plantings]);

  const applyClasses = useCallback((free: Set<string> | null, hover: string | null) => {
    const root = gridRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-bed-id]").forEach((row) => {
      const id = row.dataset.bedId ?? "";
      const isFree = Boolean(free?.has(id));
      row.classList.toggle("bed-free", isFree);
      row.classList.toggle("bed-busy", Boolean(free) && !isFree);
      row.classList.toggle("bed-hover", hover === id && isFree);
    });
  }, []);

  const plantingFor = useCallback(
    (id: string) =>
      id.startsWith("sow:") ? suggestionDates(suggestions.find((item) => item.flower.slug === id.slice(4))) : plantings.find((item) => item.id === id) ?? null,
    [plantings, suggestions],
  );

  const beginDrag = useCallback(
    (id: string) => {
      const planting = plantingFor(id);
      if (!planting) return;
      const end = planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd;
      const free = new Set(freeBedIds(plantings, bedIds, planting.fieldDate, end, id.startsWith("sow:") ? undefined : id));
      dragPaint.current = { free, hover: null, frame: 0, point: null };
      applyClasses(free, null);
    },
    [applyClasses, bedIds, plantingFor, plantings],
  );

  const hoverDrag = useCallback(
    (point: { x: number; y: number }) => {
      const drag = dragPaint.current;
      if (!drag) return;
      drag.point = point;
      if (drag.frame) return;
      drag.frame = requestAnimationFrame(() => {
        const current = dragPaint.current;
        if (!current) return;
        current.frame = 0;
        const at = current.point;
        if (!at) return;
        const hit = document.elementFromPoint(at.x, at.y)?.closest<HTMLElement>("[data-bed-id]");
        const next = hit?.dataset.bedId ?? null;
        if (next === current.hover) return;
        current.hover = next;
        applyClasses(current.free, next);
      });
    },
    [applyClasses],
  );

  const endDrag = useCallback(() => {
    const drag = dragPaint.current;
    if (drag?.frame) cancelAnimationFrame(drag.frame);
    dragPaint.current = null;
    applyClasses(null, null);
  }, [applyClasses]);

  const editPlanting = useCallback((planting: PlantingDates) => setDialog(planting), []);
  const shift = useCallback(
    async (id: string, moved: number) => {
      const result = await shiftPlanting(farmId, id, moved);
      if ("error" in result && result.error) setMessage(String(result.error));
      else {
        setMessage(null);
        router.refresh();
      }
    },
    [farmId, router],
  );

  async function dropOn(id: string, point: { x: number; y: number }) {
    const planting = plantingFor(id);
    if (!planting) return;
    const end = planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd;
    const allowed = new Set(freeBedIds(plantings, bedIds, planting.fieldDate, end, planting.id.startsWith("sow:") ? undefined : planting.id));
    const hit = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>("[data-bed-id]");
    const bedId = hit?.dataset.bedId;
    if (!bedId || !allowed.has(bedId)) {
      setMessage(bedId ? "That bed is taken for the whole time this planting is in the ground." : "Drop it on a free bed. The dates stay as they are.");
      return;
    }
    const ordered = bedsInGroup(beds, bedId).map((bed) => bed.id);
    const run = consecutiveBeds(ordered, bedId, planting.bedsNeeded ?? 1, [...allowed]);
    if (!run) {
      setMessage(`This one needs ${planting.bedsNeeded ?? 1} beds in a row, and the neighbours are not free.`);
      return;
    }
    const suggestion = id.startsWith("sow:") ? suggestions.find((item) => item.flower.slug === id.slice(4)) : null;
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
          bedIds: run,
          bedsNeeded: 1,
        })
      : await assignPlantingBeds(farmId, id, run);
    if ("error" in result && result.error) setMessage(String(result.error));
    else {
      setMessage(null);
      router.refresh();
    }
  }

  function movePlanting(id: string, point: { x: number; y: number }) {
    void dropOn(id, point);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Year plan</p>
          <h1 className="font-heading text-4xl">{season}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            One row is one bed. A bar is the time it is in the ground, from plant-out to the last cut. Perennials keep the row for the year.
          </p>
        </div>
        <button type="button" className="h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground" onClick={() => setDialog("new")} data-testid="open-planting-dialog">
          Add a planting
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Bed-weeks used" value={`${use.percent}%`} note={`${use.usedWeeks} of ${use.totalWeeks} bed-weeks`} />
        <Stat label={`Beds empty in ${months[month - 1]}`} value={String(emptyMonth.length)} note={bedIds.length ? `of ${bedIds.length}` : "No beds yet"} />
        <Stat label="Unplanted" value={String(unassigned.length + suggestions.length)} note="In the tray, dates already set" />
      </div>
      {gap && quick && gapBed ? (
        <p className="rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm">
          {labelFor(gapBed)} is open from {formatDateShort(gap.start)} for {Math.round(gap.days / 7)} weeks. {quick.name} only needs about {Math.round(quick.days / 7)} weeks in the ground.
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              const delta = diffDays(quick.window.fieldDate, gap.start);
              const moved = shiftDates({ ...quick.window, firstBloomYear: quick.window.firstBloomYear }, delta);
              void addPlanting(farmId, {
                flowerSlug: quick.slug,
                variety: moved.variety,
                method: moved.method,
                nurseryStart: moved.nurseryStart,
                fieldDate: moved.fieldDate,
                bloomStart: moved.bloomStart,
                bloomEnd: moved.bloomEnd,
                liftDate: moved.liftDate,
                firstBloomYear: moved.firstBloomYear,
                spansYears: moved.spansYears,
                bedsNeeded: 1,
              }).then(() => router.refresh());
            }}
          >
            Add {quick.name} to the tray
          </button>
        </p>
      ) : null}
      {message ? <p className="rounded-xl bg-accent px-3 py-2 text-sm" data-testid="assign-message">{message}</p> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-border bg-card p-3" data-testid="unplanted-tray">
          <p className="font-heading text-xl">Unplanted</p>
          <p className="mt-1 text-xs text-muted-foreground">Create them here first. Drag onto a bed that is free for the whole spell. The bar keeps these dates.</p>
          <ul className="mt-3 space-y-2">
            {suggestions.map((item) => (
              <li key={item.flower.slug}>
                <PlantingDragSurface
                  id={`sow:${item.flower.slug}`}
                  label={item.flower.commonName}
                  detail={`${item.action} · ${formatDateShort(item.when)}`}
                  testId={`sow-${item.flower.slug}`}
                  onDragStart={beginDrag}
                  onDragEnd={endDrag}
                  onMove={hoverDrag}
                  onDrop={(id, point) => void dropOn(id, point)}
                  onActivate={() => setDialog("new")}
                />
              </li>
            ))}
            {unassigned.map((planting) => (
              <li key={planting.id}>
                <PlantingDragSurface
                  id={planting.id}
                  label={planting.flowerName}
                  detail={`${planting.variety || "Garden mix"} · out ${formatDateShort(planting.fieldDate)} · ${planting.bedsNeeded ?? 1} bed`}
                  testId={`unassigned-${planting.id}`}
                  onDragStart={beginDrag}
                  onDragEnd={endDrag}
                  onMove={hoverDrag}
                  onDrop={(id, point) => void dropOn(id, point)}
                  onActivate={() => setDialog(planting)}
                />
              </li>
            ))}
            {unassigned.length === 0 && suggestions.length === 0 ? <li className="text-sm text-muted-foreground">Nothing waiting. Add a planting and it will sit here.</li> : null}
          </ul>
        </aside>
        <div ref={gridRef} className="max-h-[72vh] overflow-auto rounded-2xl border border-border bg-card" data-testid="bed-grid">
          <div className="min-w-[920px]">
            <div className="sticky top-0 z-20 grid grid-cols-[12rem_minmax(0,1fr)] border-b bg-card">
              <div className="sticky left-0 z-30 border-r bg-card px-3 py-2 text-xs text-muted-foreground">Bed</div>
              <div className="flex">
                {months.map((monthName) => (
                  <div key={monthName} className="w-[8.333%] border-l px-1 py-2 text-[11px] text-muted-foreground">{monthName}</div>
                ))}
              </div>
            </div>
            <div className="relative">
              {todayLeft != null ? <Marker left={todayLeft} className="bg-primary" label="Today" /> : null}
              {springLeft != null ? <Marker left={springLeft} className="bg-[#7f9a86]" label="Last frost" /> : null}
              {autumnLeft != null ? <Marker left={autumnLeft} className="bg-[#d9899a]" label="First frost" /> : null}
              {groups.map((group) => (
                <section key={group.id}>
                  <button
                    type="button"
                    className="sticky left-0 flex w-full items-center justify-between bg-secondary/70 px-3 py-1 text-left text-xs tracking-wide text-muted-foreground uppercase"
                    onClick={() => setClosed((current) => ({ ...current, [group.id]: !current[group.id] }))}
                  >
                    {group.label}
                    <span>{closed[group.id] ? "Show" : "Hide"} · {group.beds.length}</span>
                  </button>
                  {closed[group.id]
                    ? null
                    : group.beds.map((bed) => (
                        <BedRow
                          key={bed.id}
                          bed={bed}
                          plantings={byBed.get(bed.id) ?? EMPTY_PLANTINGS}
                          season={season}
                          onEdit={editPlanting}
                          onShift={shift}
                          onMove={movePlanting}
                          onDragStart={beginDrag}
                          onDragMove={hoverDrag}
                          onDragEnd={endDrag}
                        />
                      ))}
                </section>
              ))}
              {beds.length === 0 ? <p className="px-3 py-6 text-sm text-muted-foreground">Draw beds on the map, then they line up here.</p> : null}
            </div>
          </div>
        </div>
      </div>
      <PlantingDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        farmId={farmId}
        flowers={flowers}
        site={site}
        season={season}
        editing={dialog && dialog !== "new" ? dialog : null}
      />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Marker({ left, className, label }: { left: number; className: string; label: string }) {
  return (
    <div className={`pointer-events-none absolute top-0 bottom-0 z-10 w-px ${className}`} style={{ left: `calc(12rem + (100% - 12rem) * ${left / 100})` }}>
      <span className="absolute top-0 left-1 text-[10px] whitespace-nowrap text-muted-foreground">{label}</span>
    </div>
  );
}

const EMPTY_PLANTINGS: PlantingDates[] = [];

const BedRow = memo(function BedRow({
  bed,
  plantings,
  season,
  onEdit,
  onShift,
  onMove,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  bed: { id: string; name: string; blockName: string | null; blockIndex: number | null };
  plantings: PlantingDates[];
  season: number;
  onEdit: (planting: PlantingDates) => void;
  onShift: (id: string, days: number) => void;
  onMove: (id: string, point: { x: number; y: number }) => void;
  onDragStart: (id: string) => void;
  onDragMove: (point: { x: number; y: number }) => void;
  onDragEnd: () => void;
}) {
  const renders = useRef(0);
  renders.current += 1;
  return (
    <div data-bed-id={bed.id} data-testid={`bed-row-${bed.id}`} data-renders={renders.current} className="bed-row grid grid-cols-[12rem_minmax(0,1fr)] border-t">
      <div className="bed-label sticky left-0 z-10 border-r px-3 py-2 text-sm">
        <span className="block">{labelFor(bed)}</span>
        <span className="text-xs text-muted-foreground">{plantings.map((item) => item.flowerName).join(", ") || "Empty"}</span>
      </div>
      <div className="relative min-h-9">
        {plantings.map((planting) => (
          <Bar
            key={planting.id}
            planting={planting}
            season={season}
            onEdit={onEdit}
            onShift={onShift}
            onMove={onMove}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
});

function Bar({
  planting,
  season,
  onEdit,
  onShift,
  onMove,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  planting: PlantingDates;
  season: number;
  onEdit: (planting: PlantingDates) => void;
  onShift: (id: string, days: number) => void;
  onMove: (id: string, point: { x: number; y: number }) => void;
  onDragStart: (id: string) => void;
  onDragMove: (point: { x: number; y: number }) => void;
  onDragEnd: () => void;
}) {
  const bars = yearBars(planting, season);
  const slide = useRef<HTMLSpanElement>(null);
  const origin = useRef<{ x: number; y: number; width: number } | null>(null);
  const preview = useRef(0);
  return (
    <div
      className="relative h-8 cursor-grab"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        origin.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.getBoundingClientRect().width };
        preview.current = 0;
        onDragStart(planting.id);
      }}
      onPointerMove={(event) => {
        const started = origin.current;
        if (!started || !slide.current) return;
        const days = Math.round(((event.clientX - started.x) / started.width) * 365);
        preview.current = days;
        slide.current.style.transform = `translateX(${(days / 365) * 100}%)`;
        onDragMove({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={(event) => {
        const moved = preview.current;
        const started = origin.current;
        origin.current = null;
        preview.current = 0;
        if (slide.current) slide.current.style.transform = "";
        onDragEnd();
        if (!started) return;
        const vertical = Math.abs(event.clientY - started.y);
        const horizontal = Math.abs(event.clientX - started.x);
        if (vertical > 24 && vertical > horizontal) {
          onMove(planting.id, { x: event.clientX, y: event.clientY });
          return;
        }
        if (Math.abs(moved) >= 1) onShift(planting.id, moved);
        else onEdit(planting);
      }}
      onPointerCancel={() => {
        origin.current = null;
        if (slide.current) slide.current.style.transform = "";
        onDragEnd();
      }}
    >
      <span ref={slide} className="absolute inset-y-1">
        {bars.establishing ? <span className="absolute top-0 h-full rounded-sm bg-[repeating-linear-gradient(90deg,#e7f0e4_0_6px,transparent_6px_10px)]" style={boxStyle(bars.establishing)} /> : null}
        {bars.growing ? <span className="absolute top-0 h-full rounded-sm bg-[#f3e0c8]" style={boxStyle(bars.growing)} /> : null}
        {bars.bloom ? <span className="absolute top-0 h-full rounded-sm bg-[#e7b7c6]" style={boxStyle(bars.bloom)} /> : null}
        {bars.lift ? <span className="absolute top-0 h-full rounded-sm bg-[#c45b86]" style={boxStyle(bars.lift)} /> : null}
      </span>
    </div>
  );
}

function boxStyle(box: { left: number; width: number }) {
  return { left: `${box.left}%`, width: `${box.width}%` };
}

function groupBeds(beds: YearTimelineBeds): { id: string; label: string; beds: YearTimelineBeds }[] {
  const groups = new Map<string, { id: string; label: string; beds: YearTimelineBeds }>();
  const singles: YearTimelineBeds = [];
  for (const bed of [...beds].sort((a, b) => (a.blockIndex ?? 0) - (b.blockIndex ?? 0) || a.name.localeCompare(b.name, "en-GB"))) {
    if (!bed.blockId) {
      singles.push(bed);
      continue;
    }
    const group = groups.get(bed.blockId) ?? { id: bed.blockId, label: bed.blockName || "Block", beds: [] };
    group.beds.push(bed);
    groups.set(bed.blockId, group);
  }
  const list = [...groups.values()];
  if (singles.length) list.unshift({ id: "single", label: "Single beds", beds: singles });
  return list;
}

function plantingsByBed(plantings: PlantingDates[]): Map<string, PlantingDates[]> {
  const map = new Map<string, PlantingDates[]>();
  for (const planting of plantings) {
    for (const bedId of assignedBeds(planting)) {
      const list = map.get(bedId) ?? [];
      list.push(planting);
      map.set(bedId, list);
    }
  }
  return map;
}

type YearTimelineBeds = { id: string; name: string; blockId: string | null; blockName: string | null; blockIndex: number | null }[];

function bedsInGroup(beds: YearTimelineBeds, bedId: string): YearTimelineBeds {
  const bed = beds.find((item) => item.id === bedId);
  if (!bed) return [];
  return beds
    .filter((item) => item.blockId === bed.blockId)
    .sort((a, b) => (a.blockIndex ?? 0) - (b.blockIndex ?? 0) || a.name.localeCompare(b.name, "en-GB"));
}

function labelFor(bed: { name: string; blockName: string | null; blockIndex: number | null }): string {
  if (bed.blockName && bed.blockIndex) return `${bed.blockName} · Bed ${bed.blockIndex}`;
  return bed.name;
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
    bedsNeeded: 1,
  };
}
