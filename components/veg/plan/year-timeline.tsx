"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { assignPlantingBedsAction, clearPlantingBedsAction, shiftPlantingAction } from "@/app/veg/actions";
import { ukCropName } from "@/lib/veg/crop-names";
import { adviceForPlacement, badCompanionText, type AdviceNotice, type AdvicePlanting, type BedRef, type CompanionRule } from "@/lib/veg/advice";
import { AddPlantingDialog } from "@/components/veg/plan/add-planting-dialog";
import { AdviceList } from "@/components/veg/plan/advice-list";
import { PlantingDragSurface } from "@/components/veg/plan/planting-drag";
import { PutOnBedDialog } from "@/components/veg/plan/put-on-bed";
import { Button } from "@/components/veg/ui/button";
import { diffDays, formatMedium, monthName, parseISODate } from "@/lib/veg/dates";
import type { FrostContext } from "@/lib/veg/queries";
import { availabilityFor, type BedOccupancy, type BedSlot } from "@/lib/veg/planting-form";
import type { BlockView, CropView, PlantingView, TaskView } from "@/lib/veg/views";
import { cn } from "@/lib/veg/utils";

type Grouping = "crop" | "bed";

function yearLength(season: number): number {
  const start = `${season}-01-01`;
  const end = `${season}-12-31`;
  return diffDays(end, start) + 1;
}

function dayOffset(iso: string, season: number): number {
  return diffDays(iso, `${season}-01-01`);
}

function clampBar(start: string, end: string, season: number): { left: number; width: number } | null {
  const yearStart = `${season}-01-01`;
  const yearEnd = `${season}-12-31`;
  const visibleStart = start < yearStart ? yearStart : start;
  const visibleEnd = end > yearEnd ? yearEnd : end;
  if (visibleEnd < yearStart || visibleStart > yearEnd) return null;
  const days = yearLength(season);
  const left = (dayOffset(visibleStart, season) / days) * 100;
  const width = ((diffDays(visibleEnd, visibleStart) + 1) / days) * 100;
  return { left, width: Math.max(width, 0.4) };
}

export function YearTimeline({
  crops,
  blocks,
  plantings,
  season,
  today,
  frost,
  initialGroup = "bed",
  placeId = null,
  tasks = [],
  rules = [],
  spans = [],
  bedRefs = [],
  rotationYears = 3,
  standardBedLengthM = 15,
}: {
  crops: CropView[];
  blocks: BlockView[];
  plantings: PlantingView[];
  season: number;
  today: string;
  frost: FrostContext | null;
  initialGroup?: Grouping;
  placeId?: string | null;
  tasks?: TaskView[];
  rules?: CompanionRule[];
  spans?: AdvicePlanting[];
  bedRefs?: BedRef[];
  rotationYears?: number;
  standardBedLengthM?: number;
}) {
  const router = useRouter();
  const [grouping, setGrouping] = useState<Grouping>(initialGroup === "crop" ? "crop" : "bed");
  const [cropFilter, setCropFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [overList, setOverList] = useState(false);
  const [pickerId, setPickerId] = useState<string | null>(placeId);
  const [message, setMessage] = useState<string | null>(null);
  const [notices, setNotices] = useState<AdviceNotice[]>([]);
  const dragId = useRef<string | null>(null);
  const days = yearLength(season);
  const months = Array.from({ length: 12 }, (_, index) => {
    const start = `${season}-${String(index + 1).padStart(2, "0")}-01`;
    const next = index === 11 ? `${season + 1}-01-01` : `${season}-${String(index + 2).padStart(2, "0")}-01`;
    const length = diffDays(next, start);
    return { name: monthName(start).slice(0, 3), width: (length / days) * 100 };
  });
  const weeks = useMemo(() => {
    const marks: { left: number; label: string }[] = [];
    for (let offset = 0; offset < days; offset += 7) {
      const date = new Date(Date.UTC(season, 0, 1 + offset));
      marks.push({ left: (offset / days) * 100, label: String(date.getUTCDate()) });
    }
    return marks;
  }, [days, season]);

  const cropNames = ["All", ...Array.from(new Set(plantings.map((planting) => ukCropName(planting.cropName)))).sort()];
  const shown = plantings.filter((planting) => cropFilter === "All" || ukCropName(planting.cropName) === cropFilter);
  const slots: BedSlot[] = blocks.flatMap((block) =>
    block.beds.map((bed) => ({
      id: bed.id,
      label: bed.label,
      blockId: block.id,
      blockName: block.name,
      position: bed.position,
    })),
  );
  const knownBeds = new Set(slots.map((bed) => bed.id));
  const placed = shown.filter((planting) => planting.beds.some((bed) => knownBeds.has(bed.id)));
  const unassigned = shown.filter((planting) => !planting.beds.some((bed) => knownBeds.has(bed.id)));
  const occupancy: BedOccupancy[] = plantings.flatMap((planting) =>
    planting.beds.map((bed) => ({
      plantingId: planting.id,
      plantingLabel: `${ukCropName(planting.cropName)} · ${planting.cultivar}`,
      bedId: bed.id,
      start: planting.fieldPlantingDate,
      end: planting.lastHarvestDate,
    })),
  );
  const todayLeft = parseISODate(today) && today.startsWith(String(season)) ? (dayOffset(today, season) / days) * 100 : null;

  function paint(plantingId: string | null) {
    const planting = plantings.find((item) => item.id === plantingId);
    const marks = planting
      ? availabilityFor(slots, occupancy, planting.fieldPlantingDate, planting.lastHarvestDate, planting.id)
      : [];
    const byId = new Map(marks.map((mark) => [mark.bedId, mark.status]));
    document.querySelectorAll<HTMLElement>("[data-bed-id]").forEach((row) => {
      row.classList.remove("bed-free", "bed-clash");
      const status = byId.get(row.dataset.bedId ?? "");
      if (status) row.classList.add(status === "free" ? "bed-free" : "bed-clash");
    });
  }

  function asAdvice(planting: PlantingView, bedIds: string[]): AdvicePlanting {
    return {
      id: planting.id,
      cropName: planting.cropName,
      cultivar: planting.cultivar,
      rotationFamily: planting.rotationFamily,
      seasonYear: planting.seasonYear,
      start: planting.fieldPlantingDate,
      end: planting.lastHarvestDate,
      bedIds,
    };
  }

  function noticesFor(plantingId: string, bedIds: string[]): AdviceNotice[] {
    const planting = plantings.find((item) => item.id === plantingId);
    if (!planting || bedIds.length === 0) return [];
    return adviceForPlacement({
      planting: asAdvice(planting, bedIds),
      bedIds,
      others: spans.filter((item) => item.id !== plantingId),
      beds: bedRefs,
      rules,
      rotationYears,
    });
  }

  function warningFor(planting: PlantingView): string | null {
    const bedIds = planting.beds.map((bed) => bed.id);
    if (bedIds.length === 0) return null;
    return badCompanionText({
      planting: asAdvice(planting, bedIds),
      bedIds,
      others: spans.filter((item) => item.id !== planting.id),
      beds: bedRefs,
      rules,
    });
  }

  async function shiftBy(plantingId: string, delta: number) {
    if (!delta) return;
    const result = await shiftPlantingAction(plantingId, delta);
    if (!result.ok) setMessage(result.error);
    else {
      setMessage(null);
      router.refresh();
    }
  }

  async function dropOn(plantingId: string, bedId: string) {
    paint(null);
    dragId.current = null;
    const result = await assignPlantingBedsAction(plantingId, bedId);
    if (!result.ok) {
      setMessage(result.error);
      setNotices([]);
      return;
    }
    setMessage(null);
    sessionStorage.setItem("sprout-advice", plantingId);
    setNotices(noticesFor(plantingId, result.data.bedIds));
    router.refresh();
  }

  useEffect(() => {
    const plantingId = sessionStorage.getItem("sprout-advice");
    if (!plantingId) return;
    const planting = plantings.find((item) => item.id === plantingId);
    if (!planting || planting.beds.length === 0) return;
    setNotices(noticesFor(plantingId, planting.beds.map((bed) => bed.id)));
  }, [plantings]);

  async function unassign(plantingId: string) {
    paint(null);
    const result = await clearPlantingBedsAction(plantingId);
    if (!result.ok) setMessage(result.error);
    else {
      setMessage(null);
      router.refresh();
    }
  }

  function dragMove(planting: PlantingView, x: number, y: number) {
    setGhost({ x, y, label: `${ukCropName(planting.cropName)} · ${planting.cultivar}` });
    const hit = document.elementFromPoint(x, y)?.closest("[data-testid=unassigned-list]");
    setOverList(Boolean(hit));
  }

  function dragDrop(plantingId: string, x: number, y: number) {
    setGhost(null);
    setOverList(false);
    const hit = document.elementFromPoint(x, y);
    const bed = hit?.closest<HTMLElement>("[data-bed-id]");
    const list = hit?.closest("[data-testid=unassigned-list]");
    if (bed?.dataset.bedId) void dropOn(plantingId, bed.dataset.bedId);
    else if (list) void unassign(plantingId);
    else paint(null);
  }

  const editing = plantings.find((item) => item.id === editingId) ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Year plan</p>
          <h1 className="font-display text-3xl text-foreground">{season}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Each bar is nursery, then growing, then harvest. Click a bar to edit that planting. Drag it onto a bed, or back to the list on the left to take it off a bed. In bed view, one line is one bed for the whole year.
          </p>
        </div>
        <Button type="button" data-testid="open-add-planting" onClick={() => setAdding(true)}>
          Add planting
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={grouping === "crop" ? "default" : "outline"} data-testid="group-crop" onClick={() => setGrouping("crop")}>
          By crop
        </Button>
        <Button type="button" size="sm" variant={grouping === "bed" ? "default" : "outline"} data-testid="group-bed" onClick={() => setGrouping("bed")}>
          By bed
        </Button>
        <select className="h-8 rounded-lg border bg-card px-2 text-sm" aria-label="Filter by crop" value={cropFilter} onChange={(event) => setCropFilter(event.target.value)}>
          {cropNames.map((name) => <option key={name}>{name}</option>)}
        </select>
        <ul className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-[#E4EDD4]" /> Nursery</li>
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-[#E2B15A]" /> In the field</li>
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm bg-[#8C3B2A]" /> Harvest</li>
        </ul>
      </div>
      {message ? (
        <p data-testid="assign-message" className="rounded-lg bg-warning px-3 py-2 text-sm text-warning-foreground">{message}</p>
      ) : null}
      <AdviceList notices={notices} />
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className={cn("rounded-xl border bg-card p-3 transition-colors", overList && "bg-primary/10 ring-2 ring-primary")}
          data-testid="unassigned-list"
          data-drop-hot={overList ? "true" : "false"}
        >
          <p className="font-display text-lg leading-none">Not on a bed yet</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Drag a planting onto a free bed. A bed stays busy from the field date until the last harvest.</p>
          <ul className="mt-3 grid gap-2">
            {unassigned.map((planting) => (
              <li key={planting.id}>
                <PlantingDragSurface
                  id={planting.id}
                  label={ukCropName(planting.cropName)}
                  detail={`${planting.cultivar} · ${formatMedium(planting.fieldPlantingDate)} · ${planting.bedsNeeded} bed${planting.bedsNeeded === 1 ? "" : "s"}`}
                  testId={`unassigned-${planting.id}`}
                  onDragStart={(id) => {
                    dragId.current = id;
                    if (grouping !== "bed") setGrouping("bed");
                    paint(id);
                  }}
                  onDragEnd={() => paint(null)}
                  onDrop={(id, point) => {
                    const hit = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>("[data-bed-id]");
                    if (hit?.dataset.bedId) void dropOn(id, hit.dataset.bedId);
                    else paint(null);
                  }}
                  onActivate={(id) => {
                    setGrouping("bed");
                    setPickerId(id);
                  }}
                />
              </li>
            ))}
            {unassigned.length === 0 ? (
              <li className="text-sm text-muted-foreground" data-testid="unassigned-empty">
                {shown.length === 0 ? "Nothing is planned for this season yet." : "Every planting has a bed."}
              </li>
            ) : null}
          </ul>
        </aside>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[180px_minmax(0,1fr)] border-b">
              <div className="px-3 py-2 text-xs text-muted-foreground"> </div>
              <div>
                <div className="flex">
                  {months.map((month) => (
                    <div key={month.name} style={{ width: `${month.width}%` }} className="border-l px-1 py-1 text-[11px] text-muted-foreground">
                      {month.name}
                    </div>
                  ))}
                </div>
                <div className="relative h-4 border-t">
                  {weeks.filter((_, index) => index % 2 === 0).map((week) => (
                    <span key={week.left} className="absolute top-0 text-[10px] text-muted-foreground" style={{ left: `${week.left}%` }}>
                      {week.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative">
              {todayLeft != null ? (
                <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-primary" style={{ left: `calc(180px + (100% - 180px) * ${todayLeft / 100})` }} data-testid="today-line" />
              ) : null}
              {grouping === "crop" ? (
                <CropRows
                  plantings={placed}
                  season={season}
                  warningFor={warningFor}
                  onEdit={setEditingId}
                  onDragStart={(id) => {
                    dragId.current = id;
                    paint(id);
                  }}
                  onDragMove={dragMove}
                  onDrop={dragDrop}
                  onShift={(id, delta) => void shiftBy(id, delta)}
                />
              ) : null}
              {grouping === "bed" ? (
                <BedRows
                  blocks={blocks}
                  plantings={placed}
                  season={season}
                  spans={spans}
                  rotationYears={rotationYears}
                  warningFor={warningFor}
                  onEdit={setEditingId}
                  onDragStart={(id) => {
                    dragId.current = id;
                    paint(id);
                  }}
                  onDragMove={dragMove}
                  onDrop={dragDrop}
                  onShift={(id, delta) => void shiftBy(id, delta)}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <PutOnBedDialog
        planting={plantings.find((item) => item.id === pickerId) ?? null}
        beds={slots}
        occupancy={occupancy}
        noteFor={(bedId) => (pickerId ? (noticesFor(pickerId, [bedId])[0]?.message ?? null) : null)}
        onAssigned={(plantingId) => {
          sessionStorage.setItem("sprout-advice", plantingId);
        }}
        open={Boolean(pickerId)}
        onOpenChange={(open) => {
          if (!open) setPickerId(null);
        }}
      />
      {ghost ? (
        <div className="planting-ghost" style={{ left: ghost.x, top: ghost.y }} data-testid="gantt-ghost">
          {ghost.label}
        </div>
      ) : null}
      <AddPlantingDialog
        key={editing?.id ?? (adding ? "new" : "closed")}
        open={adding || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditingId(null);
          }
        }}
        editing={editing}
        tasks={tasks}
        crops={crops}
        season={season}
        today={today}
        frost={frost}
        defaultBedLengthM={standardBedLengthM}
        rules={rules}
        spans={spans}
        bedRefs={bedRefs}
        rotationYears={rotationYears}
      />
    </div>
  );
}

function Bar({
  planting,
  season,
  warning,
  onEdit,
  onDragStart,
  onDragMove,
  onDrop,
  onShift,
}: {
  planting: PlantingView;
  season: number;
  warning?: string | null;
  onEdit: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (planting: PlantingView, x: number, y: number) => void;
  onDrop: (id: string, x: number, y: number) => void;
  onShift: (id: string, days: number) => void;
}) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const slide = useRef<HTMLDivElement>(null);
  const nursery = planting.nurseryStartDate
    ? clampBar(planting.nurseryStartDate, addDaysSafe(planting.fieldPlantingDate, -1), season)
    : null;
  const growing = clampBar(planting.fieldPlantingDate, addDaysSafe(planting.firstHarvestDate, -1), season);
  const harvest = clampBar(planting.firstHarvestDate, planting.lastHarvestDate, season);
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`gantt-bar-${planting.id}`}
      className="relative h-7 cursor-grab touch-none active:cursor-grabbing"
      title={`${ukCropName(planting.cropName)} · ${planting.cultivar}. Click to edit, or drag onto a bed or back to the list.`}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.moved && Math.hypot(dx, dy) < 8) return;
        if (!current.moved) {
          current.moved = true;
          onDragStart(planting.id);
        }
        onDragMove(planting, event.clientX, event.clientY);
        const width = event.currentTarget.getBoundingClientRect().width || 1;
        const days = Math.round((dx / width) * yearLength(season));
        if (slide.current && Math.abs(dx) > Math.abs(dy)) slide.current.style.transform = `translateX(${(days / yearLength(season)) * 100}%)`;
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        drag.current = null;
        if (slide.current) slide.current.style.transform = "";
        if (!current) return;
        if (!current.moved) {
          onEdit(planting.id);
          return;
        }
        const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-bed-id]");
        const staying = planting.beds.some((bed) => bed.id === hit?.dataset.bedId);
        if (hit?.dataset.bedId && !staying) {
          onDrop(planting.id, event.clientX, event.clientY);
          return;
        }
        const width = event.currentTarget.getBoundingClientRect().width || 1;
        const days = Math.round(((event.clientX - current.x) / width) * yearLength(season));
        if (Math.abs(event.clientX - current.x) > Math.abs(event.clientY - current.y) && Math.abs(days) >= 1) onShift(planting.id, days);
        else onDrop(planting.id, event.clientX, event.clientY);
      }}
      onPointerCancel={() => {
        const moved = drag.current?.moved;
        drag.current = null;
        if (moved) onDrop(planting.id, -1, -1);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(planting.id);
        }
      }}
    >
      <div ref={slide} className="absolute inset-0">
      {nursery ? <span className="pointer-events-none absolute top-1 h-5 rounded-l-md bg-[#E4EDD4]" style={{ left: `${nursery.left}%`, width: `${nursery.width}%` }} /> : null}
      {growing ? <span className="pointer-events-none absolute top-1 h-5 bg-[#E2B15A]" style={{ left: `${growing.left}%`, width: `${growing.width}%` }} /> : null}
      {harvest ? <span className="pointer-events-none absolute top-1 h-5 rounded-r-md bg-[#8C3B2A]" style={{ left: `${harvest.left}%`, width: `${harvest.width}%` }} /> : null}
      </div>
      {warning ? (
        <span
          data-testid={`companion-warn-${planting.id}`}
          title={warning}
          className="absolute top-0 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-semibold text-warning-foreground"
          style={{ left: `${(nursery ?? growing ?? harvest)?.left ?? 0}%` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          !
        </span>
      ) : null}
    </div>
  );
}

function addDaysSafe(iso: string, days: number): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function CropRows({
  plantings,
  season,
  warningFor,
  onEdit,
  onDragStart,
  onDragMove,
  onDrop,
  onShift,
}: {
  plantings: PlantingView[];
  season: number;
  warningFor: (planting: PlantingView) => string | null;
  onEdit: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (planting: PlantingView, x: number, y: number) => void;
  onDrop: (id: string, x: number, y: number) => void;
  onShift: (id: string, days: number) => void;
}) {
  const groups = new Map<string, PlantingView[]>();
  for (const planting of plantings) {
    const name = ukCropName(planting.cropName);
    const list = groups.get(name) ?? [];
    list.push(planting);
    groups.set(name, list);
  }
  return (
    <div>
      {[...groups.entries()].map(([name, rows]) => (
        <div key={name}>
          <div className="grid grid-cols-[180px_minmax(0,1fr)] bg-muted/40">
            <p className="px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{name}</p>
            <div />
          </div>
          {rows.map((planting) => (
            <div key={planting.id} className="grid grid-cols-[180px_minmax(0,1fr)] border-t">
              <button type="button" className="px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onEdit(planting.id)}>
                <span className="block">{planting.cultivar}</span>
                <span className="text-xs text-muted-foreground">
                  {planting.beds.map((bed) => bed.label).join(", ") || "No bed"}
                </span>
              </button>
              <Bar planting={planting} season={season} warning={warningFor(planting)} onEdit={onEdit} onDragStart={onDragStart} onDragMove={onDragMove} onDrop={onDrop} onShift={onShift} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const FAMILY_COLOR: Record<string, string> = {
  Brassicas: "#d7e4c8",
  Alliums: "#efe3c2",
  Legumes: "#e7d7c4",
  Solanaceae: "#f0d5cc",
  "Roots/Umbellifers": "#f3e2c4",
  Cucurbits: "#dce8c8",
  "Leafy/other": "#e4e7df",
};

function BedHistory({ bedId, season, spans, years }: { bedId: string; season: number; spans: AdvicePlanting[]; years: number }) {
  const seen = new Set<string>();
  const chips: { year: number; family: string }[] = [];
  for (const planting of spans) {
    if (!planting.rotationFamily || !planting.bedIds.includes(bedId)) continue;
    if (planting.seasonYear > season || planting.seasonYear < season - years) continue;
    const key = `${planting.seasonYear}|${planting.rotationFamily}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push({ year: planting.seasonYear, family: planting.rotationFamily });
  }
  chips.sort((a, b) => a.year - b.year || a.family.localeCompare(b.family));
  const last = [...chips].reverse().find((chip) => chip.year < season);
  if (chips.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid={`bed-history-${bedId}`}>
      {last ? <span className="text-[10px] text-muted-foreground">Last: {last.family} {last.year}</span> : null}
      {chips.map((chip) => (
        <span key={`${chip.year}-${chip.family}`} className="rounded px-1 text-[10px]" style={{ background: FAMILY_COLOR[chip.family] ?? "#e4e7df", color: "#24302b" }}>
          {chip.family} {chip.year}
        </span>
      ))}
    </div>
  );
}

function BedRows({
  blocks,
  plantings,
  season,
  spans,
  rotationYears,
  warningFor,
  onEdit,
  onDragStart,
  onDragMove,
  onDrop,
  onShift,
}: {
  blocks: BlockView[];
  plantings: PlantingView[];
  season: number;
  spans: AdvicePlanting[];
  rotationYears: number;
  warningFor: (planting: PlantingView) => string | null;
  onEdit: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (planting: PlantingView, x: number, y: number) => void;
  onDrop: (id: string, x: number, y: number) => void;
  onShift: (id: string, days: number) => void;
}) {
  return (
    <div data-testid="bed-view">
      {blocks.length === 0 ? <p className="px-3 py-6 text-sm text-muted-foreground">Draw beds on the farm map, then they line up here.</p> : null}
      {blocks.map((block) => (
        <div key={block.id}>
          <div className="grid grid-cols-[180px_minmax(0,1fr)] bg-muted/40">
            <p className="px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{block.name}</p>
            <div />
          </div>
          {block.beds.map((bed) => {
            const rows = plantings.filter((planting) => planting.beds.some((item) => item.id === bed.id));
            return (
              <div
                key={bed.id}
                data-bed-id={bed.id}
                data-testid={`bed-row-${bed.id}`}
                className={cn("grid grid-cols-[180px_minmax(0,1fr)] border-t")}
              >
                <div className="px-3 py-2 text-sm">
                  <span className="block">{bed.label}{bed.sharedBedId ? " · Shared" : ""}</span>
                  <span className="text-xs text-muted-foreground">{rows.map((planting) => ukCropName(planting.cropName)).join(", ") || "Empty"}</span>
                  <BedHistory bedId={bed.id} season={season} spans={spans} years={rotationYears} />
                </div>
                <div className="relative min-h-9">
                  {rows.map((planting) => (
                    <Bar key={planting.id} planting={planting} season={season} warning={warningFor(planting)} onEdit={onEdit} onDragStart={onDragStart} onDragMove={onDragMove} onDrop={onDrop} onShift={onShift} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
