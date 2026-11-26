"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveFrostSettingsAction, saveRotationYearsAction, saveStandardBedLengthAction } from "@/app/veg/actions";
import { displayOfMetres, matchingPreset, metresFromDisplay } from "@/lib/veg/bed-length";
import { controlClass, Field } from "@/components/veg/field";
import { PageHeader } from "@/components/veg/page-header";
import { Button } from "@/components/veg/ui/button";
import { matchPlace, searchPlaces } from "@/lib/veg/place";
import type { FrostLocation } from "@/lib/veg/seed/frost-locations";

export function FrostSettings({
  locations,
  currentLabel,
  currentLocationId,
  manualLast,
  manualFirst,
  useManual,
  rotationYears,
  standardBedLengthM,
  displayUnit,
}: {
  locations: FrostLocation[];
  currentLabel: string;
  currentLocationId: string | null;
  manualLast: string | null;
  manualFirst: string | null;
  useManual: boolean;
  rotationYears: number;
  standardBedLengthM: number;
  displayUnit: "m" | "ft";
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(currentLocationId);
  const [label, setLabel] = useState(currentLabel);
  const [manual, setManual] = useState(useManual);
  const [lastFrost, setLastFrost] = useState(manualLast ?? "04-15");
  const [firstFrost, setFirstFrost] = useState(manualFirst ?? "11-01");
  const [pending, startTransition] = useTransition();
  const [seasonsBack, setSeasonsBack] = useState(rotationYears);
  const [bedMetres, setBedMetres] = useState(standardBedLengthM);
  const preset = matchingPreset(bedMetres);
  const shownLength =
    displayUnit === "ft" && preset === 15 ? 50 : displayUnit === "ft" && preset === 30 ? 100 : Math.round(displayOfMetres(bedMetres, displayUnit) * 10) / 10;
  const direct = useMemo(() => (query.trim() ? matchPlace(query, locations) : null), [query, locations]);
  const listed = useMemo(() => searchPlaces(query, locations).slice(0, 12), [query, locations]);
  const selected = locations.find((place) => place.id === chosen) ?? null;

  function choose(place: FrostLocation, nextLabel: string) {
    setChosen(place.id);
    setLabel(nextLabel);
    setManual(false);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Farm settings"
        title="Frost dates"
        description="Choose a city in Britain, Europe, or North America, or type a town, postcode, or latitude and longitude. The nearest place’s average frost dates are used when you plan. You can type your own dates instead."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <Field label="Town, postcode or lat, lng" hint="Examples: Edinburgh, New York, Paris, EH1 1YZ, or 51.75, -1.26">
            <input className={controlClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a place" />
          </Field>
          {direct ? (
            <button
              type="button"
              className="mt-3 w-full rounded-xl border bg-wheat/40 px-3 py-2 text-left text-sm"
              onClick={() => choose(direct.location, direct.label)}
            >
              Use {direct.label} → {direct.location.name}
              <span className="mt-1 block text-xs text-muted-foreground">
                Last spring frost {direct.location.lastSpringFrost} · first autumn frost {direct.location.firstAutumnFrost}
              </span>
            </button>
          ) : null}
          <ul className="mt-3 grid gap-1">
            {listed.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => choose(place, place.name)}
                  className={`flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${chosen === place.id ? "bg-wheat" : "hover:bg-muted"}`}
                >
                  <span>
                    {place.name}
                    <span className="block text-xs text-muted-foreground">{place.region}</span>
                  </span>
                  <span className="num text-xs">{place.lastSpringFrost} / {place.firstAutumnFrost}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <h2 className="font-display text-2xl">{label || "No place chosen"}</h2>
          {selected && !manual ? (
            <p className="mt-2 text-sm leading-6">
              Average last spring air frost <span className="num font-medium">{selected.lastSpringFrost}</span>. Average first autumn air frost <span className="num font-medium">{selected.firstAutumnFrost}</span>.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Choose a station, or enter your own dates.</p>
          )}
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} />
            Use my own frost dates
          </label>
          {manual ? (
            <div className="mt-3 grid gap-3">
              <Field label="Last spring frost" hint="Month-day, 04-15">
                <input className={`${controlClass} num`} value={lastFrost} onChange={(event) => setLastFrost(event.target.value)} />
              </Field>
              <Field label="First autumn frost" hint="Month-day, 11-01">
                <input className={`${controlClass} num`} value={firstFrost} onChange={(event) => setFirstFrost(event.target.value)} />
              </Field>
            </div>
          ) : null}
          <Button
            className="mt-4"
            disabled={pending || (!manual && !selected)}
            onClick={() => {
              startTransition(async () => {
                const result = await saveFrostSettingsAction({
                  locationLabel: label,
                  frostLocationId: selected?.id ?? null,
                  latitude: selected?.latitude ?? null,
                  longitude: selected?.longitude ?? null,
                  manualLastSpringFrost: manual ? lastFrost : null,
                  manualFirstAutumnFrost: manual ? firstFrost : null,
                  useManualFrost: manual,
                });
                if (!result.ok) toast.error(result.error);
                else toast.success("Frost dates saved.");
              });
            }}
          >
            {pending ? "Saving…" : "Save frost dates"}
          </Button>
          {selected ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Source: {selected.sourceName}{" "}
              <a className="underline" href={selected.sourceUrl}>
                View the station table
              </a>
            </p>
          ) : null}
        </section>
      </div>
      <section className="max-w-xl rounded-2xl border bg-card p-5" data-testid="rotation-setting">
        <h2 className="font-display text-2xl">Crop rotation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          When you put a planting on a bed, Sprout Logic looks back this many seasons for the same family. The note never blocks the bed. A second brassica in the same season is only a note.
        </p>
        <div className="mt-3 flex items-end gap-2">
          <Field label="Seasons to look back">
            <input
              className={`${controlClass} num max-w-24`}
              type="number"
              min={1}
              max={8}
              value={seasonsBack}
              aria-label="Seasons to look back"
              onChange={(event) => setSeasonsBack(Number(event.target.value))}
            />
          </Field>
          <Button
            type="button"
            onClick={() => {
              startTransition(async () => {
                const result = await saveRotationYearsAction(seasonsBack);
                if (!result.ok) toast.error(result.error);
                else toast.success("Rotation look-back saved.");
              });
            }}
          >
            Save
          </Button>
        </div>
      </section>
      <section className="max-w-xl rounded-2xl border bg-card p-5" data-testid="bed-length-setting">
        <h2 className="font-display text-2xl">Usual bed length</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          New plantings start at this length. You can still change the length on each planting. Lengths are stored in metres.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant={preset === 15 ? "default" : "outline"} onClick={() => setBedMetres(15)}>
            {displayUnit === "ft" ? "50 ft" : "15 m"}
          </Button>
          <Button type="button" variant={preset === 30 ? "default" : "outline"} onClick={() => setBedMetres(30)}>
            {displayUnit === "ft" ? "100 ft" : "30 m"}
          </Button>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <Field label={displayUnit === "ft" ? "Custom length (ft)" : "Custom length (m)"}>
            <input
              className={`${controlClass} num max-w-28`}
              type="number"
              min={0.4}
              step={0.1}
              data-testid="custom-bed-length"
              value={shownLength}
              aria-label="Usual bed length"
              onChange={(event) => setBedMetres(metresFromDisplay(Number(event.target.value), displayUnit))}
            />
          </Field>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await saveStandardBedLengthAction(bedMetres);
                if (!result.ok) toast.error(result.error);
                else toast.success("Usual bed length saved.");
              });
            }}
          >
            Save
          </Button>
        </div>
      </section>
    </div>
  );
}
