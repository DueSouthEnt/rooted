"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCrops, setCropStatus } from "@/lib/actions";
import type { Flower } from "@/lib/flower";
import { hardyLabel, lifeCycleLabel, vaseLifeLabel } from "@/lib/flower";
import { fitLabel, starterMix, starterStory, type Recommendation } from "@/lib/recommend";
import type { CropRecord } from "@/lib/records";
import type { SitePlan } from "@/lib/tasks";
import { formatLength, formatTempRange, type Units } from "@/lib/units";

export function FlowerBoard({
  farmId,
  recommendations,
  crops,
  site,
  placeName,
  units,
}: {
  farmId: string;
  recommendations: Recommendation[];
  crops: CropRecord[];
  site: SitePlan;
  placeName: string | null;
  units: Units;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "great" | "care" | "risky" | "plan">("all");
  const [busy, setBusy] = useState(false);
  const selected = new Set(crops.map((crop) => crop.flower_slug));
  const mix = useMemo(() => starterMix(recommendations), [recommendations]);

  const visible = recommendations.filter((item) => {
    const haystack = `${item.flower.commonName} ${item.flower.latinName}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (filter === "plan") return selected.has(item.flower.slug);
    if (filter === "great") return item.fit === "great" || item.fit === "good";
    if (filter === "care") return item.fit === "care";
    if (filter === "risky") return item.fit === "risky";
    return true;
  });

  async function add(slugs: string[]) {
    setBusy(true);
    await saveCrops(farmId, slugs, "add");
    setBusy(false);
    router.refresh();
  }

  async function remove(slug: string) {
    setBusy(true);
    await saveCrops(farmId, [slug], "remove");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">A first season</p>
        <h2 className="font-heading mt-1 text-2xl">Starter mix</h2>
        <p className="mt-2 text-sm leading-relaxed">{starterStory(site, mix, placeName)}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {mix.map((item) => (
            <li key={item.flower.slug} className="rounded-full bg-secondary px-3 py-1 text-sm">
              {item.flower.commonName}
            </li>
          ))}
        </ul>
        <Button className="mt-4 h-11" disabled={busy || mix.length === 0} onClick={() => add(mix.map((item) => item.flower.slug))}>
          Add this mix
        </Button>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search flowers" className="h-11" />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["great", "Safe bets"],
              ["care", "Needs a hand"],
              ["risky", "Gambles"],
              ["plan", "On the plan"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={
                filter === value
                  ? "rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
                  : "rounded-full border border-border px-3 py-1 text-sm"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-3">
        {visible.map((item) => (
          <FlowerRow
            key={item.flower.slug}
            item={item}
            units={units}
            onPlan={selected.has(item.flower.slug)}
            crop={crops.find((crop) => crop.flower_slug === item.flower.slug)}
            busy={busy}
            onAdd={() => add([item.flower.slug])}
            onRemove={() => remove(item.flower.slug)}
            onStatus={(status) => {
              void setCropStatus(farmId, item.flower.slug, status).then(() => router.refresh());
            }}
          />
        ))}
      </ul>
      {visible.length === 0 ? <p className="text-sm text-muted-foreground">Nothing matches. Try a plainer word, like cosmos.</p> : null}
    </div>
  );
}

function FlowerRow({
  item,
  units,
  onPlan,
  crop,
  busy,
  onAdd,
  onRemove,
  onStatus,
}: {
  item: Recommendation;
  units: Units;
  onPlan: boolean;
  crop?: CropRecord;
  busy: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onStatus: (status: "planting" | "established") => void;
}) {
  const flower = item.flower;
  const germ = formatTempRange(flower.germTempMinC, flower.germTempMaxC, units);
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: flower.colour }} />
            <h3 className="font-heading text-xl">{flower.commonName}</h3>
          </div>
          <p className="text-sm text-muted-foreground italic">{flower.latinName}</p>
        </div>
        <Badge variant="secondary">{fitLabel(item.fit)}</Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{item.reasons[0]}</p>
      {item.reasons.slice(1).map((reason) => (
        <p key={reason} className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {reason}
        </p>
      ))}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Fact label="Life" value={`${lifeCycleLabel(flower.lifeCycle)} · ${hardyLabel(flower.hardyClass)} · ${flower.rhs}`} />
        <Fact label="Spacing" value={`${formatLength(flower.spacingCm, units)} · rows ${formatLength(flower.rowSpacingCm, units)}`} />
        <Fact label="Height" value={formatLength(flower.heightCm, units)} />
        <Fact label="Vase" value={vaseLifeLabel(flower)} />
        <Fact label="Sun" value={flower.sun === "full" ? "Full sun" : flower.sun === "part" ? "Part shade" : "Shade"} />
        <Fact label="Germination" value={germ ?? "See the notes"} />
      </dl>
      <p className="mt-2 text-sm text-muted-foreground">Varieties: {flower.varieties}</p>
      <p className="mt-1 text-sm">{flower.notes}</p>
      {flower.caution ? <p className="mt-1 text-sm text-destructive">{flower.caution}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onPlan ? (
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onRemove}>
            Take off the plan
          </Button>
        ) : (
          <Button type="button" className="h-11" disabled={busy} onClick={onAdd}>
            Add to the plan
          </Button>
        )}
        {onPlan && (flower.lifeCycle === "perennial" || flower.lifeCycle === "shrub" || flower.lifeCycle === "bulb" || flower.biennialSummerSow) ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={crop?.status === "established"}
              onChange={(event) => onStatus(event.target.checked ? "established" : "planting")}
            />
            Already in the ground
          </label>
        ) : null}
      </div>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
