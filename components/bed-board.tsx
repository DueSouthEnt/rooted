"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addBed, assignFlower, deleteBed, unassignFlower, updatePlanTop } from "@/lib/actions";
import { backToFront, bedWarnings, plantCount, tallEdgeLabel } from "@/lib/beds";
import type { Flower } from "@/lib/flower";
import type { BedPlantRecord, BedRecord, FarmRecord } from "@/lib/records";
import type { SitePlan } from "@/lib/tasks";
import { generateTasks } from "@/lib/tasks";
import { addDays, formatDateShort } from "@/lib/dates";
import { cmFromFeet, cmFromMetres, formatLength, type Units } from "@/lib/units";

export function BedBoard({
  farm,
  site,
  beds,
  plants,
  flowers,
  units,
}: {
  farm: FarmRecord;
  site: SitePlan | null;
  beds: BedRecord[];
  plants: BedPlantRecord[];
  flowers: Flower[];
  units: Units;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(flowers[0]?.slug ?? null);
  const [state, formAction, pending] = useActionState(addBed.bind(null, farm.id), {});
  const [length, setLength] = useState(units === "metric" ? "4" : "13");
  const [width, setWidth] = useState(units === "metric" ? "1.2" : "4");

  const bySlug = new Map(flowers.map((flower) => [flower.slug, flower]));
  const lengthCm = units === "metric" ? cmFromMetres(Number(length) || 0) : cmFromFeet(Number(length) || 0);
  const widthCm = units === "metric" ? cmFromMetres(Number(width) || 0) : cmFromFeet(Number(width) || 0);

  async function toggle(bedId: string) {
    if (!selected) return;
    const exists = plants.some((plant) => plant.bed_id === bedId && plant.flower_slug === selected);
    if (exists) await unassignFlower(farm.id, bedId, selected);
    else await assignFlower(farm.id, bedId, selected);
    router.refresh();
  }

  const presets =
    units === "metric"
      ? [
          ["0.9 × 3 m", "3", "0.9"],
          ["1.2 × 4 m", "4", "1.2"],
          ["1.2 × 8 m", "8", "1.2"],
        ]
      : [
          ["3 × 10 ft", "10", "3"],
          ["4 × 8 ft", "8", "4"],
          ["4 × 20 ft", "20", "4"],
        ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-heading text-2xl">Add a bed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A single {units === "metric" ? "1.2 × 4 m" : "4 × 13 ft"} bed is enough for a first season. Annuals in one bed, things that stay in another.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map(([label, presetLength, presetWidth]) => (
            <button
              key={label}
              type="button"
              className="rounded-full border border-border px-3 py-1 text-sm"
              onClick={() => {
                setLength(presetLength);
                setWidth(presetWidth);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Name
            <Input name="name" className="mt-1 h-11" placeholder="Annual bed" />
          </label>
          <label className="text-sm">
            Length ({units === "metric" ? "m" : "ft"})
            <Input name="lengthDisplay" className="mt-1 h-11" value={length} onChange={(event) => setLength(event.target.value)} inputMode="decimal" />
          </label>
          <label className="text-sm">
            Width ({units === "metric" ? "m" : "ft"})
            <Input name="widthDisplay" className="mt-1 h-11" value={width} onChange={(event) => setWidth(event.target.value)} inputMode="decimal" />
          </label>
          <input type="hidden" name="lengthCm" value={lengthCm} />
          <input type="hidden" name="widthCm" value={widthCm} />
          <label className="text-sm sm:col-span-2">
            Kind of bed
            <select name="bedKind" className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3">
              <option value="annual">Annual rotation — cleared each year</option>
              <option value="perennial">Permanent — perennials and shrubs</option>
              <option value="bulb">Bulbs</option>
            </select>
          </label>
          {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
          <Button type="submit" className="h-11 sm:col-span-2" disabled={pending}>
            {pending ? "Adding…" : "Add bed"}
          </Button>
        </form>
      </section>

      <form action={updatePlanTop.bind(null, farm.id)} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Top of the plan is
          <select name="planTop" defaultValue={farm.plan_top} className="mt-1 h-11 rounded-lg border border-input bg-card px-3">
            <option value="north">North</option>
            <option value="east">East</option>
            <option value="south">South</option>
            <option value="west">West</option>
          </select>
        </label>
        <Button type="submit" variant="outline" className="h-11">
          Save orientation
        </Button>
        {site ? <p className="text-sm text-muted-foreground">{tallEdgeLabel(site.hemisphere)}</p> : null}
      </form>

      {flowers.length === 0 ? (
        <p className="text-sm">No flowers on the plan yet. Add some, then tap one and tap a bed.</p>
      ) : (
        <div>
          <p className="text-sm font-medium">Tap a flower, then tap a bed.</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {flowers.map((flower) => (
              <button
                key={flower.slug}
                type="button"
                draggable
                onDragStart={() => setSelected(flower.slug)}
                onClick={() => setSelected(flower.slug)}
                className={
                  selected === flower.slug
                    ? "shrink-0 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "shrink-0 rounded-full border border-border bg-card px-3 py-2 text-sm"
                }
              >
                {flower.commonName}
              </button>
            ))}
          </div>
        </div>
      )}

      {beds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm">A bed with no edges is just a thought. Add one above.</p>
      ) : (
        <ul className="space-y-4">
          {beds.map((bed) => {
            const assigned = plants
              .filter((plant) => plant.bed_id === bed.id)
              .map((plant) => bySlug.get(plant.flower_slug))
              .filter((flower): flower is Flower => Boolean(flower));
            const warnings = bedWarnings(bed.bed_kind, assigned);
            const order = backToFront(assigned);
            return (
              <li
                key={bed.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void toggle(bed.id)}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-xl">{bed.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatLength(bed.length_cm, units)} by {formatLength(bed.width_cm, units)} ·{" "}
                      {bed.bed_kind === "annual" ? "Annual rotation" : bed.bed_kind === "perennial" ? "Permanent" : "Bulbs"}
                    </p>
                  </div>
                  <form action={deleteBed.bind(null, farm.id, bed.id)}>
                    <button type="submit" className="text-sm text-muted-foreground underline">
                      Remove
                    </button>
                  </form>
                </div>
                <button type="button" onClick={() => void toggle(bed.id)} className="mt-3 block w-full rounded-lg border border-dashed border-border p-3 text-left">
                  <div
                    className="mx-auto border border-foreground/20 bg-secondary/60"
                    style={{
                      width: "100%",
                      maxWidth: 420,
                      aspectRatio: `${Math.max(bed.length_cm, 1)} / ${Math.max(bed.width_cm, 1)}`,
                    }}
                  >
                    <div className="flex h-full flex-col justify-end gap-1 p-2">
                      {order.map((flower) => (
                        <div key={flower.slug} className="h-3 rounded-sm" style={{ background: flower.colour, width: `${40 + flower.heightCm / 4}%` }} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selected ? `Tap to ${plants.some((plant) => plant.bed_id === bed.id && plant.flower_slug === selected) ? "remove" : "add"} ${bySlug.get(selected)?.commonName ?? "the flower"}` : "Choose a flower first."}
                  </p>
                </button>
                <ul className="mt-3 space-y-2 text-sm">
                  {assigned.map((flower) => {
                    const count = plantCount(bed.length_cm, bed.width_cm, flower.spacingCm, flower.rowSpacingCm);
                    return (
                      <li key={flower.slug} className="flex items-start justify-between gap-3">
                        <span>
                          {flower.commonName}: {count.tight ? "bed is tighter than the spacing" : `${count.rows} rows × ${count.perRow} = ${count.total} plants`}
                          <span className="block text-muted-foreground">
                            {formatLength(flower.spacingCm, units)} in the row, {formatLength(flower.rowSpacingCm, units)} between rows
                          </span>
                        </span>
                        <button type="button" className="underline" onClick={() => void unassignFlower(farm.id, bed.id, flower.slug).then(() => router.refresh())}>
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {order.length > 1 ? (
                  <p className="mt-2 text-sm">
                    Plant from the back: {order.map((flower) => flower.commonName).join(" → ")}.
                  </p>
                ) : null}
                {warnings.map((warning) => (
                  <p key={warning.text} className="mt-2 text-sm text-muted-foreground">
                    {warning.text}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      {site && flowers.length > 0 ? <Timeline flowers={flowers} site={site} /> : null}
    </div>
  );
}

function Timeline({ flowers, site }: { flowers: Flower[]; site: SitePlan }) {
  const tasks = generateTasks(
    flowers.map((flower) => ({ flower, status: "planting" as const })),
    site,
  );
  const bars = flowers
    .map((flower) => {
      const mark = tasks.find(
        (task) => task.flowerSlug === flower.slug && (task.category === "harvest" || task.category === "note"),
      );
      if (!mark) return null;
      const end = addDays(mark.dueDate, flower.bloomWeeks * 7);
      return { flower, start: mark.dueDate, end, establishing: mark.category === "note" };
    })
    .filter((bar): bar is NonNullable<typeof bar> => Boolean(bar))
    .sort((a, b) => a.start.localeCompare(b.start));
  if (bars.length === 0) return null;
  const rangeStart = bars[0].start < site.lastSpringFrost ? bars[0].start : site.lastSpringFrost;
  const rangeEnd = bars.reduce((latest, bar) => (bar.end > latest ? bar.end : latest), site.firstAutumnFrost);
  const span = Math.max(1, daysBetween(rangeStart, rangeEnd));

  return (
    <section>
      <h2 className="font-heading text-2xl">When they flower</h2>
      <p className="mt-1 text-sm text-muted-foreground">A sketch, not a promise. Weather will edit it.</p>
      <ul className="mt-3 space-y-2">
        {bars.map((bar) => {
          const left = (daysBetween(rangeStart, bar.start) / span) * 100;
          const width = Math.max(2, (daysBetween(bar.start, bar.end) / span) * 100);
          return (
            <li key={bar.flower.slug} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
              <span className="truncate">{bar.flower.commonName}</span>
              <div className="relative h-6 rounded bg-secondary">
                <div
                  className="absolute top-1 h-4 rounded"
                  style={{
                    left: `${left}%`,
                    width: `${Math.min(width, 100 - left)}%`,
                    background: bar.flower.colour,
                    opacity: bar.establishing ? 0.45 : 1,
                  }}
                  title={`${formatDateShort(bar.start)} – ${formatDateShort(bar.end)}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}
