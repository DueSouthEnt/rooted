"use client";

import { useActionState, useState } from "react";
import { stations } from "@/data/stations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Disclaimer } from "@/components/disclaimer";
import { MapPin } from "@/components/map-pin";
import type { ActionState } from "@/lib/actions";
import { formatDate } from "@/lib/dates";
import { RHS_RATINGS } from "@/lib/hardiness";

interface ClimateState {
  hemisphere: "north" | "south";
  frostFree: boolean;
  occasionalFrost: boolean;
  lastSpring: string;
  firstAutumn: string;
  seasonLengthDays: number;
  usdaZone: string;
  rhs: string;
  summer: "cool" | "mild" | "hot";
  winterMinC: string;
  tropical: boolean;
  seasonYear: number;
  source: string;
  note: string;
}

const QUICK = ["london", "edinburgh", "manchester", "cardiff", "belfast", "dublin", "paris", "amsterdam", "berlin", "truro"];

const emptyClimate = (): ClimateState => ({
  hemisphere: "north",
  frostFree: false,
  occasionalFrost: false,
  lastSpring: "",
  firstAutumn: "",
  seasonLengthDays: 0,
  usdaZone: "",
  rhs: "",
  summer: "mild",
  winterMinC: "",
  tropical: false,
  seasonYear: new Date().getFullYear(),
  source: "manual",
  note: "",
});

export function PlaceForm({
  action,
  submitLabel,
  initialName = "",
  initial,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  initialName?: string;
  initial?: Partial<ClimateState> & { placeName?: string; country?: string; postalCode?: string; latitude?: number | null; longitude?: number | null };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Array<{ id: string; label: string; detail: string; latitude: number; longitude: number; postalCode: string | null; country: string | null }>>([]);
  const [placeName, setPlaceName] = useState(initial?.placeName ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [latitude, setLatitude] = useState<number | null>(initial?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initial?.longitude ?? null);
  const [climate, setClimate] = useState<ClimateState>({ ...emptyClimate(), ...initial, winterMinC: initial?.winterMinC ?? "" });
  const [status, setStatus] = useState("");
  const [searching, setSearching] = useState(false);

  async function loadClimate(lat: number, lon: number) {
    setStatus("Asking ten years of weather what it thinks…");
    setLatitude(lat);
    setLongitude(lon);
    try {
      const response = await fetch(`/api/climate?lat=${lat}&lon=${lon}`);
      const body = await response.json();
      if (!response.ok) {
        setStatus(body.error ?? "Weather history didn't answer. Type the dates yourself.");
        setClimate((current) => ({ ...current, source: "manual" }));
        return;
      }
      setClimate({
        hemisphere: body.hemisphere,
        frostFree: body.frostFree,
        occasionalFrost: body.occasionalFrost,
        lastSpring: body.lastSpring ?? "",
        firstAutumn: body.firstAutumn ?? "",
        seasonLengthDays: body.seasonLengthDays,
        usdaZone: body.usdaZone ?? "",
        rhs: body.rhs ?? "",
        summer: body.summer,
        winterMinC: body.winterMinC == null ? "" : String(body.winterMinC),
        tropical: body.tropical,
        seasonYear: body.seasonYear,
        source: body.source,
        note: body.note,
      });
      setStatus("");
    } catch {
      setStatus("Couldn't reach the weather service. You can still type the frost dates.");
    }
  }

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`/api/places?q=${encodeURIComponent(value)}`);
      const body = await response.json();
      setHits(body.hits ?? []);
    } finally {
      setSearching(false);
    }
  }

  function chooseHit(hit: (typeof hits)[number]) {
    setPlaceName(hit.label);
    setCountry(hit.country ?? "");
    setPostalCode(hit.postalCode ?? "");
    setHits([]);
    setQuery(hit.label);
    void loadClimate(hit.latitude, hit.longitude);
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="farm-name">
          Farm name
        </label>
        <Input id="farm-name" name="name" defaultValue={initialName} required className="h-11" placeholder="Home patch" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="place-search">
          Postcode, town, or place
        </label>
        <Input
          id="place-search"
          value={query}
          onChange={(event) => void search(event.target.value)}
          className="h-11"
          placeholder="EH1, BS1 4ST, or Paris"
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2">
          {QUICK.map((id) => {
            const station = stations.find((item) => item.id === id);
            if (!station) return null;
            return (
              <button
                key={id}
                type="button"
                className="rounded-full border border-border bg-card px-3 py-1 text-sm hover:bg-secondary"
                onClick={() =>
                  chooseHit({
                    id,
                    label: station.name,
                    detail: station.country,
                    latitude: station.latitude,
                    longitude: station.longitude,
                    postalCode: station.postalCodes[0] ?? null,
                    country: station.country,
                  })
                }
              >
                {station.name}
              </button>
            );
          })}
        </div>
        {searching ? <p className="text-sm text-muted-foreground">Looking that up…</p> : null}
        {hits.length > 0 ? (
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" className="block w-full px-3 py-3 text-left hover:bg-secondary" onClick={() => chooseHit(hit)}>
                  <span className="font-medium">{hit.label}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{hit.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <MapPin latitude={latitude} longitude={longitude} onPick={(lat, lon) => void loadClimate(lat, lon)} />

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Latitude
          <Input
            className="mt-1 h-11"
            name="latitude"
            value={latitude ?? ""}
            onChange={(event) => setLatitude(event.target.value === "" ? null : Number(event.target.value))}
            inputMode="decimal"
          />
        </label>
        <label className="text-sm">
          Longitude
          <Input
            className="mt-1 h-11"
            name="longitude"
            value={longitude ?? ""}
            onChange={(event) => setLongitude(event.target.value === "" ? null : Number(event.target.value))}
            inputMode="decimal"
          />
        </label>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={() => {
          if (latitude == null || longitude == null) {
            setStatus("Add a latitude and longitude first, or tap the map.");
            return;
          }
          void loadClimate(latitude, longitude);
        }}
      >
        Estimate from this point
      </Button>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {climate.note ? <p className="text-sm leading-relaxed">{climate.note}</p> : null}
      {climate.lastSpring && climate.firstAutumn ? (
        <p className="text-sm">
          Last spring frost {formatDate(climate.lastSpring)}. First autumn frost {formatDate(climate.firstAutumn)}. The date boxes follow your browser’s own order.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Last spring frost
          <Input
            className="mt-1 h-11"
            type="date"
            name="lastSpring"
            value={climate.lastSpring}
            onChange={(event) => setClimate({ ...climate, lastSpring: event.target.value, frostFree: false, source: "manual" })}
          />
        </label>
        <label className="text-sm">
          First autumn frost
          <Input
            className="mt-1 h-11"
            type="date"
            name="firstAutumn"
            value={climate.firstAutumn}
            onChange={(event) => setClimate({ ...climate, firstAutumn: event.target.value, frostFree: false, source: "manual" })}
          />
        </label>
        <label className="text-sm">
          RHS hardiness
          <select
            className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3"
            name="rhs"
            value={climate.rhs}
            onChange={(event) => setClimate({ ...climate, rhs: event.target.value, source: climate.source === "open-meteo" ? "open-meteo" : "manual" })}
          >
            <option value="">Not sure</option>
            {RHS_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          USDA zone
          <Input
            className="mt-1 h-11"
            name="usdaZone"
            value={climate.usdaZone}
            onChange={(event) => setClimate({ ...climate, usdaZone: event.target.value, source: "manual" })}
            placeholder="8b"
          />
        </label>
        <label className="text-sm">
          Summer character
          <select
            className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3"
            name="summer"
            value={climate.summer}
            onChange={(event) =>
              setClimate({ ...climate, summer: event.target.value as ClimateState["summer"], source: "manual" })
            }
          >
            <option value="cool">Cool</option>
            <option value="mild">Mild</option>
            <option value="hot">Hot</option>
          </select>
        </label>
        <label className="text-sm">
          Season year
          <Input
            className="mt-1 h-11"
            name="seasonYear"
            type="number"
            value={climate.seasonYear}
            onChange={(event) => setClimate({ ...climate, seasonYear: Number(event.target.value) })}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={climate.frostFree}
          onChange={(event) => setClimate({ ...climate, frostFree: event.target.checked, source: "manual" })}
        />
        <span>Frost is rare here. Don't invent a frost date — I'll plan around a long season instead.</span>
      </label>

      <input type="hidden" name="placeName" value={placeName} />
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="postalCode" value={postalCode} />
      <input type="hidden" name="hemisphere" value={climate.hemisphere} />
      <input type="hidden" name="frostFree" value={String(climate.frostFree)} />
      <input type="hidden" name="occasionalFrost" value={String(climate.occasionalFrost)} />
      <input type="hidden" name="seasonLength" value={climate.seasonLengthDays || ""} />
      <input type="hidden" name="winterMinC" value={climate.winterMinC} />
      <input type="hidden" name="tropical" value={String(climate.tropical)} />
      <input type="hidden" name="frostSource" value={climate.source} />
      <input type="hidden" name="frostNote" value={climate.note} />

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Disclaimer compact />
      <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
