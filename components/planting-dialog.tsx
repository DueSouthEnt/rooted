"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addPlanting, updatePlanting } from "@/lib/actions";
import { diffDays } from "@/lib/dates";
import type { Flower } from "@/lib/flower";
import { composeFlowerDates, type SowStyle } from "@/lib/planting-dates";
import { scheduleFlower, type PlantingDates, type PlantingMethod } from "@/lib/schedule";
import type { SitePlan } from "@/lib/tasks";

export function PlantingDialog({
  open,
  onOpenChange,
  farmId,
  flowers,
  site,
  season,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  flowers: Flower[];
  site: SitePlan | null;
  season: number;
  editing?: PlantingDates | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto bg-card sm:max-w-lg" data-testid="planting-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.flowerName}` : "Add a planting"}</DialogTitle>
          <DialogDescription>
            Set the dates before it goes on a bed. Change the sow date and the plant-out and the first bloom follow.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <PlantingForm
            key={editing?.id ?? "new"}
            farmId={farmId}
            flowers={flowers}
            site={site}
            season={season}
            editing={editing ?? null}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PlantingForm({
  farmId,
  flowers,
  site,
  season,
  editing,
  onDone,
}: {
  farmId: string;
  flowers: Flower[];
  site: SitePlan | null;
  season: number;
  editing: PlantingDates | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const initial = flowers.find((flower) => flower.slug === editing?.flowerSlug) ?? null;
  const [query, setQuery] = useState(editing ? `${editing.flowerName} ${editing.variety}` : "");
  const [flower, setFlower] = useState<Flower | null>(initial);
  const [variety, setVariety] = useState(editing?.variety ?? "");
  const [style, setStyle] = useState<SowStyle>(editing?.method === "indoor" ? "indoor" : "direct");
  const [sowDate, setSowDate] = useState(editing?.nurseryStart ?? editing?.fieldDate ?? site?.lastSpringFrost ?? `${season}-03-01`);
  const [daysInNursery, setDaysInNursery] = useState(editing?.daysInNursery ?? 28);
  const [fieldLock, setFieldLock] = useState<string | null>(null);
  const [daysToMaturity, setDaysToMaturity] = useState(editing?.daysToMaturity ?? initial?.daysFromPlantToBloom ?? 60);
  const [bloomLock, setBloomLock] = useState<string | null>(null);
  const [bloomWeeks, setBloomWeeks] = useState(editing?.bloomWeeks ?? initial?.bloomWeeks ?? 8);
  const [endLock, setEndLock] = useState<string | null>(null);
  const [bedsNeeded, setBedsNeeded] = useState(editing?.bedsNeeded ?? 1);
  const [bedLengthM, setBedLengthM] = useState(editing?.bedLengthM ?? 4);
  const [spacingCm, setSpacingCm] = useState(editing?.spacingCm ?? initial?.spacingCm ?? 25);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const matches = flowers
    .filter((item) => `${item.commonName} ${item.latinName} ${item.varieties}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 6);
  const varieties = flower ? flower.varieties.split(",").map((item) => item.trim()).filter(Boolean) : [];
  const dates = useMemo(
    () =>
      composeFlowerDates({
        style,
        sowDate,
        daysInNursery,
        daysToMaturity,
        bloomWeeks,
        fieldDate: fieldLock,
        bloomStart: bloomLock,
        bloomEnd: endLock,
      }),
    [style, sowDate, daysInNursery, daysToMaturity, bloomWeeks, fieldLock, bloomLock, endLock],
  );
  const along = spacingCm > 0 ? Math.floor((bedLengthM * 100) / spacingCm) : 0;

  function choose(next: Flower) {
    setFlower(next);
    setQuery(next.commonName);
    const scheduled = site ? scheduleFlower(next, site) : null;
    const indoor = scheduled?.method === "indoor" || (next.indoorWeeksBeforeFrost != null && next.sowMethod !== "direct");
    setStyle(indoor ? "indoor" : "direct");
    const sow = scheduled?.nurseryStart ?? scheduled?.fieldDate ?? sowDate;
    setSowDate(sow);
    setDaysInNursery(scheduled?.nurseryStart ? Math.max(0, diffDays(scheduled.nurseryStart, scheduled.fieldDate)) : 28);
    setDaysToMaturity(next.daysFromPlantToBloom);
    setBloomWeeks(next.bloomWeeks);
    setSpacingCm(next.spacingCm);
    setVariety(scheduled?.variety ?? next.varieties.split(",")[0]?.trim() ?? "");
    setFieldLock(null);
    setBloomLock(null);
    setEndLock(null);
  }

  async function save() {
    if (!flower) {
      setError("Choose a flower first.");
      return;
    }
    setBusy(true);
    setError("");
    const base = site ? scheduleFlower(flower, site) : null;
    const delta = base ? diffDays(base.fieldDate, dates.fieldDate) : 0;
    const liftDate = base?.liftDate ? addDaysSafe(base.liftDate, delta) : editing?.liftDate ?? null;
    const method = storedMethod(flower, style);
    const payload = {
      variety,
      method,
      nurseryStart: dates.nurseryStart,
      fieldDate: dates.fieldDate,
      bloomStart: dates.bloomStart,
      bloomEnd: dates.bloomEnd,
      liftDate,
      firstBloomYear: flower.yearsToEstablish > 1 ? season + flower.yearsToEstablish - 1 : Number(dates.bloomStart.slice(0, 4)),
      spansYears: flower.lifeCycle !== "annual" && flower.lifeCycle !== "biennial",
      bedsNeeded,
      daysToMaturity,
      daysInNursery: style === "indoor" ? daysInNursery : 0,
      bloomWeeks,
      spacingCm,
      bedLengthM,
      notes,
    };
    const result = editing
      ? await updatePlanting(farmId, editing.id, payload)
      : await addPlanting(farmId, { flowerSlug: flower.slug, ...payload });
    setBusy(false);
    if ("error" in result && typeof result.error === "string") {
      setError(result.error);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div className="grid gap-3 px-4 pb-4">
      <label className="text-sm">
        Flower
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setFlower(null);
          }}
          placeholder="Calendula, sweet pea, dahlia…"
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
          data-testid="planting-flower-search"
        />
      </label>
      {flower ? null : (
        <ul className="grid gap-1">
          {matches.map((item) => (
            <li key={item.slug}>
              <button type="button" className="w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-secondary" onClick={() => choose(item)}>
                {item.commonName}
                <span className="ml-2 text-xs text-muted-foreground">{item.latinName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {flower ? (
        <label className="text-sm">
          Variety
          <input value={variety} onChange={(event) => setVariety(event.target.value)} list="varieties" className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
          <datalist id="varieties">
            {varieties.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
      ) : null}
      <fieldset className="grid gap-2 text-sm">
        <legend>Method</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="style" checked={style === "indoor"} onChange={() => { setStyle("indoor"); setFieldLock(null); }} />
          Under cover, then plant out
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="style" checked={style === "direct"} onChange={() => { setStyle("direct"); setFieldLock(null); }} />
          Sow or plant straight into the bed
        </label>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          {style === "indoor" ? "Sow under cover" : "Sow or plant"}
          <input type="date" value={sowDate} onChange={(event) => { setSowDate(event.target.value); setFieldLock(null); setBloomLock(null); setEndLock(null); }} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>
        <label className="text-sm">
          Weeks in the nursery
          <input
            type="number"
            min={0}
            value={Math.round(daysInNursery / 7)}
            disabled={style === "direct"}
            onChange={(event) => { setDaysInNursery(Number(event.target.value) * 7); setFieldLock(null); }}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 disabled:opacity-50"
          />
        </label>
        <label className="text-sm">
          Plant out
          <input type="date" value={dates.fieldDate} onChange={(event) => setFieldLock(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>
        <label className="text-sm">
          Days to maturity
          <input type="number" min={0} value={daysToMaturity} onChange={(event) => { setDaysToMaturity(Number(event.target.value)); setBloomLock(null); setEndLock(null); }} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>
        <label className="text-sm">
          First bloom
          <input type="date" value={dates.bloomStart} onChange={(event) => { setBloomLock(event.target.value); setEndLock(null); }} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>
        <label className="text-sm">
          Weeks in flower
          <input type="number" min={1} value={bloomWeeks} onChange={(event) => { setBloomWeeks(Number(event.target.value)); setEndLock(null); }} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="planting-dates">
        In the bed from {dates.fieldDate} until {dates.bloomEnd}. First bloom {dates.bloomStart}.
        {style === "indoor" ? ` Sown under cover ${dates.nurseryStart}.` : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Beds needed
          <input type="number" min={1} max={40} value={bedsNeeded} onChange={(event) => setBedsNeeded(Number(event.target.value))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>
        <label className="text-sm">
          Bed length (m)
          <input type="number" min={0.4} step={0.1} value={bedLengthM} onChange={(event) => setBedLengthM(Number(event.target.value))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>
        <label className="text-sm">
          Spacing (cm)
          <input type="number" min={1} value={spacingCm} onChange={(event) => setSpacingCm(Number(event.target.value))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">About {along} plants along each {bedLengthM} m bed, at {spacingCm} cm. {bedsNeeded} bed{bedsNeeded === 1 ? "" : "s"}.</p>
      <label className="text-sm">
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void save()} className="h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground" data-testid="save-planting">
        {busy ? "Saving…" : editing ? "Save changes" : "Add to unplanted"}
      </button>
    </div>
  );
}

function storedMethod(flower: Flower, style: SowStyle): PlantingMethod {
  if (style === "indoor") return "indoor";
  if (flower.lifeCycle === "tuber" || flower.sowMethod === "tuber") return "tuber";
  if (flower.lifeCycle === "bulb" || flower.sowMethod === "bulb") return "bulb";
  if (flower.lifeCycle === "corm" || flower.sowMethod === "corm") return "corm";
  if (flower.sowMethod === "crown" || flower.lifeCycle === "perennial" || flower.lifeCycle === "shrub") return "crown";
  return "direct";
}

function addDaysSafe(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
