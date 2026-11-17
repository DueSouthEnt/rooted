"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlantingDialog } from "@/components/planting-dialog";
import { PlantingDragSurface } from "@/components/planting-drag";
import { addPlanting, assignMany, assignPlantingBeds, shiftPlanting } from "@/lib/actions";
import { diffDays, formatDateShort } from "@/lib/dates";
import type { Flower } from "@/lib/flower";
import { assignedBeds, bedsEmptyInMonth, bedWeekUtilisation, consecutiveBeds, freeBedIds, longestOpenGap } from "@/lib/occupancy";
import { frostMarker, shiftDates, yearBars, type FlowerWindow, type PlantingDates, type SowSuggestion } from "@/lib/schedule";
import { placeSuccessionSeries } from "@/lib/succession";
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
  const dragPaint = useRef<{
    free: Set<string>;
    hover: string | null;
    frame: number;
    point: { x: number; y: number } | null;
    series: PlantingDates[] | null;
  } | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PlantingDates | null | "new">(null);
  const [rows, setRows] = useState(plantings);
  const [hiddenSow, setHiddenSow] = useState<string[]>([]);
  const propsKey = plantings.map((item) => `${item.id}:${assignedBeds(item).join(".")}:${item.fieldDate}`).join("|");
  const propsKeyRef = useRef(propsKey);
  if (propsKeyRef.current !== propsKey) {
    propsKeyRef.current = propsKey;
    setRows(plantings);
  }
  const days = diffDays(`${season}-01-01`, `${season}-12-31`) + 1;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const todayLeft = today.startsWith(String(season)) ? (diffDays(`${season}-01-01`, today) / days) * 100 : null;
  const springLeft = lastSpring ? frostMarker(lastSpring, season) : null;
  const autumnLeft = firstAutumn ? frostMarker(firstAutumn, season) : null;
  const groups = useMemo(() => groupBeds(beds), [beds]);
  const bedIds = useMemo(() => beds.map((bed) => bed.id), [beds]);
  const byBed = useMemo(() => plantingsByBed(rows), [rows]);
  const use = useMemo(() => bedWeekUtilisation(bedIds, rows, season), [bedIds, rows, season]);
  const month = today.startsWith(String(season)) ? Number(today.slice(5, 7)) : 6;
  const emptyMonth = useMemo(() => bedsEmptyInMonth(bedIds, rows, season, month), [bedIds, rows, season, month]);
  const gap = useMemo(
    () => longestOpenGap(bedIds, rows, season, today.startsWith(String(season)) ? today : `${season}-03-01`),
    [bedIds, rows, season, today],
  );
  const quick = gap ? quickCrops.filter((crop) => crop.days <= gap.days && crop.days >= 21).sort((a, b) => a.days - b.days)[0] : null;
  const gapBed = beds.find((bed) => bed.id === gap?.bedId);
  const unassigned = useMemo(
    () => rows.filter((item) => assignedBeds(item).length < (item.bedsNeeded ?? 1)),
    [rows],
  );
  const trayGroups = useMemo(() => groupTray(unassigned), [unassigned]);
  const visibleSuggestions = suggestions.filter((item) => !hiddenSow.includes(item.flower.slug));

  const applyClasses = useCallback((free: Set<string> | null, hover: string | null) => {
    const root = gridRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-bed-id]").forEach((row) => {
      const id = row.dataset.bedId ?? "";
      const isFree = Boolean(free?.has(id));
      row.classList.toggle("bed-free", isFree);
      row.classList.toggle("bed-busy", Boolean(free) && !isFree);
      row.classList.toggle("bed-hover", hover === id && isFree);
      row.classList.remove("bed-preview");
    });
  }, []);

  const plantingFor = useCallback(
    (id: string) =>
      id.startsWith("sow:") ? suggestionDates(suggestions.find((item) => item.flower.slug === id.slice(4))) : rows.find((item) => item.id === id) ?? null,
    [rows, suggestions],
  );

  const seriesFor = useCallback(
    (id: string) => {
      if (!id.startsWith("group:")) return null;
      return rows
        .filter((item) => item.successionGroup === id.slice(6) && assignedBeds(item).length < (item.bedsNeeded ?? 1))
        .sort((a, b) => (a.successionIndex ?? 0) - (b.successionIndex ?? 0));
    },
    [rows],
  );

  const beginDrag = useCallback(
    (id: string) => {
      const series = seriesFor(id);
      const planting = series?.[0] ?? plantingFor(id);
      if (!planting) return;
      const end = planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd;
      const free = new Set(freeBedIds(rows, bedIds, planting.fieldDate, end, planting.id.startsWith("sow:") ? undefined : planting.id));
      dragPaint.current = { free, hover: null, frame: 0, point: null, series };
      applyClasses(free, null);
    },
    [applyClasses, bedIds, plantingFor, rows, seriesFor],
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
        const next = bedUnderPointer(gridRef.current, at.x, at.y);
        if (next === current.hover) return;
        current.hover = next;
        applyClasses(current.free, next);
        if (current.series && next) {
          const plan = placeSuccessionSeries({
            series: current.series,
            startBedId: next,
            blockBedIds: bedsInGroup(beds, next).map((bed) => bed.id),
            plantings: rows,
          });
          for (const placement of plan.placed) {
            gridRef.current?.querySelector(`[data-bed-id="${placement.bedId}"]`)?.classList.add("bed-preview");
          }
        }
      });
    },
    [applyClasses, beds, rows],
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

  function showError(text: string) {
    setToast(text);
    setMessage(text);
    window.setTimeout(() => setToast((current) => (current === text ? null : current)), 5000);
  }

  async function dropOn(id: string, point: { x: number; y: number }, mode: "add" | "move" = "add") {
    if (id.startsWith("group:")) {
      await dropGroup(id.slice(6), point);
      return;
    }
    const planting = plantingFor(id);
    if (!planting) return;
    const end = planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd;
    const ignore = planting.id.startsWith("sow:") ? undefined : planting.id;
    const allowed = new Set(freeBedIds(rows, bedIds, planting.fieldDate, end, ignore));
    const bedId = bedUnderPointer(gridRef.current, point.x, point.y);
    if (!bedId || !allowed.has(bedId)) {
      showError(bedId ? "That bed is taken for the whole time this planting is in the ground." : "Drop it on a free bed. The dates stay as they are.");
      return;
    }
    const have = assignedBeds(planting);
    const capacity = planting.bedsNeeded ?? 1;
    if (mode === "add" && !id.startsWith("sow:") && have.length >= capacity) {
      showError("That planting is already on all its beds.");
      return;
    }
    const ordered = bedsInGroup(beds, bedId).map((item) => item.id);
    const remaining = mode === "move" ? capacity : Math.max(1, capacity - have.length);
    const extra = consecutiveBeds(ordered, bedId, remaining, [...allowed]) ?? (allowed.has(bedId) ? [bedId] : null);
    if (!extra) {
      showError("That bed is not free for this planting.");
      return;
    }
    const run = mode === "move" ? extra.slice(0, capacity) : [...have, ...extra.filter((item) => !have.includes(item))].slice(0, capacity);
    gridRef.current?.setAttribute("data-save", "");
    const started = performance.now();
    const suggestion = id.startsWith("sow:") ? suggestions.find((item) => item.flower.slug === id.slice(4)) : null;
    const previous = rows;
    const optimisticId = suggestion ? `pending-${suggestion.flower.slug}` : id;
    const placed: PlantingDates = { ...planting, id: optimisticId, bedId: run[0] ?? null, bedIds: run };
    setRows((current) => [...current.filter((item) => item.id !== id && item.id !== optimisticId), placed]);
    if (suggestion) setHiddenSow((current) => [...current, suggestion.flower.slug]);
    requestAnimationFrame(() => {
      gridRef.current?.setAttribute("data-settled-ms", String(Math.round(performance.now() - started)));
    });
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
          bedsNeeded: capacity,
          quiet: true,
        })
      : await assignPlantingBeds(farmId, id, run);
    if ("error" in result && result.error) {
      setRows(previous);
      if (suggestion) setHiddenSow((current) => current.filter((slug) => slug !== suggestion.flower.slug));
      gridRef.current?.setAttribute("data-save", "error");
      showError(String(result.error));
      return;
    }
    if (suggestion && "id" in result && result.id) {
      setRows((current) => current.map((item) => (item.id === optimisticId ? { ...item, id: result.id as string } : item)));
    }
    const placedCount = run.length;
    setMessage(placedCount < capacity ? `${placedCount} of ${capacity} beds placed. Drop it again for the rest.` : null);
    gridRef.current?.setAttribute("data-save", "ok");
  }

  async function dropGroup(groupId: string, point: { x: number; y: number }) {
    const series = rows
      .filter((item) => item.successionGroup === groupId && assignedBeds(item).length < (item.bedsNeeded ?? 1))
      .sort((a, b) => (a.successionIndex ?? 0) - (b.successionIndex ?? 0));
    const bedId = bedUnderPointer(gridRef.current, point.x, point.y);
    if (!series.length || !bedId) {
      showError("Drop the succession on a free bed.");
      return;
    }
    const plan = placeSuccessionSeries({
      series,
      startBedId: bedId,
      blockBedIds: bedsInGroup(beds, bedId).map((bed) => bed.id),
      plantings: rows,
    });
    if (!plan.placed.length) {
      showError("That bed is not free for the first sowing.");
      return;
    }
    const previous = rows;
    setRows((current) =>
      current.map((item) => {
        const placement = plan.placed.find((placed) => placed.id === item.id);
        return placement ? { ...item, bedId: placement.bedId, bedIds: [placement.bedId] } : item;
      }),
    );
    gridRef.current?.setAttribute("data-save", "");
    const result = await assignMany(
      farmId,
      plan.placed.map((placement) => ({ plantingId: placement.id, bedIds: [placement.bedId] })),
    );
    if ("error" in result && result.error) {
      setRows(previous);
      gridRef.current?.setAttribute("data-save", "error");
      showError(String(result.error));
      return;
    }
    const names = new Map(beds.map((bed) => [bed.id, labelFor(bed)]));
    const placedText = plan.placed.map((placement) => {
      const sowing = series.find((item) => item.id === placement.id);
      return `${sowing?.flowerName ?? "Sowing"} ${sowing?.successionIndex ?? ""} on ${names.get(placement.bedId) ?? "a bed"}`;
    });
    const leftText = plan.left.length ? ` ${plan.left.length} still in the tray.` : "";
    setMessage(`${placedText.join(". ")}.${leftText}`);
    setToast(`${placedText.join(". ")}.${leftText}`);
    gridRef.current?.setAttribute("data-save", "ok");
  }

  function movePlanting(id: string, point: { x: number; y: number }) {
    void dropOn(id, point, "move");
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
      {toast ? (
        <p className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[#3f2a2e] px-4 py-2 text-sm text-[#fffaf4] shadow-lg" data-testid="save-toast" role="status">
          {toast}
        </p>
      ) : null}
      <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-border bg-card p-3" data-testid="unplanted-tray">
          <p className="font-heading text-xl">Unplanted</p>
          <p className="mt-1 text-xs text-muted-foreground">Create them here first. Drag onto a bed that is free for the whole spell. The bar keeps these dates.</p>
          <ul className="mt-3 space-y-2">
            {visibleSuggestions.map((item) => (
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
            {trayGroups.map((group) =>
              group.kind === "single" ? (
                <li key={group.planting.id}>
                  <PlantingDragSurface
                    id={group.planting.id}
                    label={group.planting.flowerName}
                    detail={trayDetail(group.planting)}
                    testId={`unassigned-${group.planting.id}`}
                    onDragStart={beginDrag}
                    onDragEnd={endDrag}
                    onMove={hoverDrag}
                    onDrop={(id, point) => void dropOn(id, point, "add")}
                    onActivate={() => setDialog(group.planting)}
                  />
                </li>
              ) : (
                <li key={group.id} className="rounded-xl border border-border p-2" data-testid={`succession-${group.id}`}>
                  <PlantingDragSurface
                    id={`group:${group.id}`}
                    label={`${group.plantings[0]?.flowerName ?? "Sowing"} ${group.plantings[0]?.variety ?? ""}`.trim()}
                    detail={`${group.plantings.length} successions`}
                    testId={`succession-drag-${group.id}`}
                    onDragStart={beginDrag}
                    onDragEnd={endDrag}
                    onMove={hoverDrag}
                    onDrop={(id, point) => void dropOn(id, point, "add")}
                    onActivate={() => setDialog(group.plantings[0] ?? null)}
                  />
                  <ul className="mt-2 space-y-1">
                    {group.plantings.map((planting) => (
                      <li key={planting.id}>
                        <PlantingDragSurface
                          id={planting.id}
                          label={`${planting.successionIndex ?? ""}. ${formatDateShort(planting.bloomStart)}`}
                          detail={trayDetail(planting)}
                          testId={`unassigned-${planting.id}`}
                          onDragStart={beginDrag}
                          onDragEnd={endDrag}
                          onMove={hoverDrag}
                          onDrop={(id, point) => void dropOn(id, point, "add")}
                          onActivate={() => setDialog(planting)}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ),
            )}
            {trayGroups.length === 0 && visibleSuggestions.length === 0 ? <li className="text-sm text-muted-foreground">Nothing waiting. Add a planting and it will sit here.</li> : null}
          </ul>
        </aside>
        <div ref={gridRef} className="max-h-[72vh] overflow-auto rounded-2xl border border-border bg-card" data-testid="bed-grid">
          <div className="min-w-[920px]">
            <div className="sticky top-0 z-20 grid grid-cols-[12rem_minmax(0,1fr)] border-b bg-card">
              <div className="sticky left-0 z-30 border-r bg-card px-3 py-2 text-xs text-muted-foreground">Bed</div>
              <div>
                <div className="flex">
                  {months.map((monthName) => (
                    <div key={monthName} className="w-[8.333%] border-l px-1 py-1 text-[11px] text-muted-foreground">{monthName}</div>
                  ))}
                </div>
                <div className="relative h-4 border-t">
                  {weekTicks(season).map((tick) => (
                    <span key={tick.left} className="absolute top-0 text-[10px] text-muted-foreground" style={{ left: `${tick.left}%` }}>{tick.label}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative">
              {todayLeft != null ? <Marker left={todayLeft} className="bg-primary" label="Today" /> : null}
              {springLeft != null ? <Marker left={springLeft} className="bg-[#7f9a86]/70" label="" /> : null}
              {autumnLeft != null ? <Marker left={autumnLeft} className="bg-[#d9899a]/70" label="" /> : null}
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
        successionCount={
          dialog && dialog !== "new" && dialog.successionGroup
            ? rows.filter((item) => item.successionGroup === dialog.successionGroup).length
            : 1
        }
        onDeleted={(ids) => setRows((current) => current.filter((item) => !ids.includes(item.id)))}
        onUnplaced={(id) => setRows((current) => current.map((item) => (item.id === id ? { ...item, bedId: null, bedIds: [] } : item)))}
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
  const node = useRef<HTMLDivElement>(null);
  const renders = useRef(0);
  renders.current += 1;
  useEffect(() => {
    node.current?.setAttribute("data-renders", String(renders.current));
  });
  return (
    <div ref={node} data-bed-id={bed.id} data-testid={`bed-row-${bed.id}`} className="bed-row grid h-8 grid-cols-[12rem_minmax(0,1fr)] border-t">
      <div className="bed-label sticky left-0 z-10 flex items-center border-r px-3 text-xs">
        <span className="truncate">{labelFor(bed)}</span>
      </div>
      <div className="relative h-8">
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
}, (previous, next) => {
  if (previous.bed.id !== next.bed.id || previous.season !== next.season) return false;
  if (previous.plantings.length !== next.plantings.length) return false;
  return previous.plantings.every((item, index) => {
    const other = next.plantings[index];
    return item.id === other?.id && item.fieldDate === other.fieldDate && item.bloomEnd === other.bloomEnd && item.bedId === other.bedId;
  });
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
  const origin = useRef<{ x: number; y: number; width: number; dragging: boolean } | null>(null);
  const preview = useRef(0);
  return (
    <div
      className="relative h-full cursor-grab"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        origin.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.getBoundingClientRect().width, dragging: false };
        preview.current = 0;
      }}
      onPointerMove={(event) => {
        const started = origin.current;
        if (!started || !slide.current) return;
        const distance = Math.hypot(event.clientX - started.x, event.clientY - started.y);
        if (!started.dragging && distance < 8) return;
        if (!started.dragging) {
          started.dragging = true;
          onDragStart(planting.id);
        }
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
        if (!started.dragging) {
          onEdit(planting);
          return;
        }
        const bedId = bedUnderPointer(null, event.clientX, event.clientY);
        const staying = assignedBeds(planting);
        if (bedId && !staying.includes(bedId)) {
          onMove(planting.id, { x: event.clientX, y: event.clientY });
          return;
        }
        if (Math.abs(moved) >= 1) onShift(planting.id, moved);
      }}
      onPointerCancel={() => {
        origin.current = null;
        if (slide.current) slide.current.style.transform = "";
        onDragEnd();
      }}
    >
      <span ref={slide} className="absolute inset-x-0 inset-y-0.5" data-testid={`gantt-bar-${planting.id}`}>
        {bars.nursery ? <span className="absolute top-0 h-full rounded-l-sm bg-[#e7f0e4]" style={boxStyle(bars.nursery)} /> : null}
        {bars.establishing ? <span className="absolute top-0 h-full bg-[repeating-linear-gradient(90deg,#e7f0e4_0_6px,transparent_6px_10px)]" style={boxStyle(bars.establishing)} /> : null}
        {bars.growing ? <span className="absolute top-0 h-full bg-[#f3e0c8]" style={boxStyle(bars.growing)} /> : null}
        {bars.bloom ? <span className="absolute top-0 h-full rounded-r-sm bg-[#e7b7c6]" style={boxStyle(bars.bloom)} /> : null}
        {bars.lift ? <span className="absolute top-0 h-full bg-[#c45b86]" style={boxStyle(bars.lift)} /> : null}
        <span className="pointer-events-none absolute inset-0 flex items-center truncate px-1 text-[11px] font-medium text-[#2c2622]">
          {planting.flowerName}
          {planting.variety ? ` · ${planting.variety}` : ""}
        </span>
      </span>
    </div>
  );
}

function weekTicks(season: number): { left: number; label: string }[] {
  const ticks: { left: number; label: string }[] = [];
  const start = Date.UTC(season, 0, 1);
  const days = Math.round((Date.UTC(season + 1, 0, 1) - start) / 86_400_000);
  for (let offset = 0; offset < days; offset += 14) {
    const date = new Date(start + offset * 86_400_000);
    ticks.push({ left: (offset / days) * 100, label: String(date.getUTCDate()) });
  }
  return ticks;
}

function bedUnderPointer(grid: HTMLElement | null, x: number, y: number): string | null {
  const stack = document.elementsFromPoint(x, y);
  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    const row = node.closest<HTMLElement>("[data-bed-id]");
    if (row?.dataset.bedId) return row.dataset.bedId;
  }
  if (!grid) return null;
  for (const row of grid.querySelectorAll<HTMLElement>("[data-bed-id]")) {
    const rect = row.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return row.dataset.bedId ?? null;
  }
  return null;
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

function trayDetail(planting: PlantingDates): string {
  const placed = assignedBeds(planting).length;
  const need = planting.bedsNeeded ?? 1;
  const beds = need === 1 ? "1 bed" : `${placed} of ${need} beds placed`;
  return `${planting.variety || "Garden mix"} · out ${formatDateShort(planting.fieldDate)} · ${beds}`;
}

function groupTray(plantings: PlantingDates[]): Array<{ kind: "single"; planting: PlantingDates } | { kind: "group"; id: string; plantings: PlantingDates[] }> {
  const groups = new Map<string, PlantingDates[]>();
  const singles: PlantingDates[] = [];
  for (const planting of plantings) {
    if (!planting.successionGroup) singles.push(planting);
    else {
      const list = groups.get(planting.successionGroup) ?? [];
      list.push(planting);
      groups.set(planting.successionGroup, list);
    }
  }
  return [
    ...[...groups.entries()].map(([id, list]) => ({
      kind: "group" as const,
      id,
      plantings: list.sort((a, b) => (a.successionIndex ?? 0) - (b.successionIndex ?? 0)),
    })),
    ...singles.map((planting) => ({ kind: "single" as const, planting })),
  ];
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
