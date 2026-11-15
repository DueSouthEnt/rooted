"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { assignFlower, saveFarmBoundary, saveMappedBed, unassignFlower, updateMappedBed } from "@/lib/actions";
import { plantCount } from "@/lib/beds";
import type { Flower } from "@/lib/flower";
import {
  closeRing,
  formatSquareMetres,
  isBedRectangle,
  isFarmBoundary,
  pointInRing,
  rectangleAreaM2,
  rectangleFromCorners,
  rectangleRing,
  ringAreaM2,
  satelliteTileUrl,
  withRotation,
  type BedRectangle,
  type FarmBoundary,
  type LngLat,
} from "@/lib/geo";
import type { BedPlantRecord, BedRecord, CropRecord, FarmRecord } from "@/lib/records";
import { formatLength, type Units } from "@/lib/units";

type Mode = "move" | "outline" | "bed";

export function FarmMap({
  farm,
  beds,
  plants,
  crops,
  flowers,
  units,
}: {
  farm: FarmRecord;
  beds: BedRecord[];
  plants: BedPlantRecord[];
  crops: CropRecord[];
  flowers: Flower[];
  units: Units;
}) {
  const router = useRouter();
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const drawn = useRef<import("leaflet").LayerGroup | null>(null);
  const [mode, setMode] = useState<Mode>("move");
  const [outline, setOutline] = useState<LngLat[]>([]);
  const [draft, setDraft] = useState<BedRectangle | null>(null);
  const [bedName, setBedName] = useState("");
  const [bedKind, setBedKind] = useState<"annual" | "perennial" | "bulb">("annual");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [query, setQuery] = useState(farm.place_name ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const modeRef = useRef(mode);
  const selectedRef = useRef(selected);
  modeRef.current = mode;
  selectedRef.current = selected;

  const bySlug = useMemo(() => new Map(flowers.map((flower) => [flower.slug, flower])), [flowers]);
  const planned = crops
    .map((crop) => bySlug.get(crop.flower_slug))
    .filter((flower): flower is Flower => Boolean(flower));
  const boundary = isFarmBoundary(farm.boundary) ? farm.boundary : null;

  useEffect(() => {
    const element = node.current;
    if (!element || mapRef.current) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || mapRef.current || !element) return;
      const center: [number, number] =
        farm.latitude != null && farm.longitude != null ? [farm.latitude, farm.longitude] : [54.5, -2.5];
      const map = L.map(element, { zoomControl: true }).setView(center, farm.latitude != null ? 18 : 6);
      mapRef.current = map;
      L.tileLayer(satelliteTileUrl(), {
        attribution:
          'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 20,
      }).addTo(map);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.85 },
      ).addTo(map);
      drawn.current = L.layerGroup().addTo(map);
      map.on("click", (event) => {
        if (modeRef.current !== "outline") return;
        const next: LngLat = [event.latlng.lng, event.latlng.lat];
        setOutline((current) => [...current, next]);
      });
      setMapReady(true);
      const resize = () => map.invalidateSize();
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      window.addEventListener("resize", resize);
      setTimeout(resize, 250);
      map.once("unload", () => {
        observer.disconnect();
        window.removeEventListener("resize", resize);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [farm.latitude, farm.longitude]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled) return;
      const map = mapRef.current;
      const group = drawn.current;
      if (!map || !group) return;
      group.clearLayers();
      if (boundary) {
        const ring = boundary.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polygon(ring, {
          color: "#f4efe4",
          weight: 2,
          dashArray: "6 6",
          fillColor: "#f7d5dc",
          fillOpacity: 0.12,
        }).addTo(group);
      }
      if (outline.length > 0) {
        L.polyline(
          outline.map(([lng, lat]) => [lat, lng] as [number, number]),
          { color: "#f7d5dc", weight: 3 },
        ).addTo(group);
        for (const [lng, lat] of outline) {
          L.circleMarker([lat, lng], { radius: 5, color: "#fffaf4", fillColor: "#d9899a", fillOpacity: 1, weight: 2 }).addTo(
            group,
          );
        }
      }
      for (const bed of beds) {
        if (!isBedRectangle(bed.geometry)) continue;
        const ring = rectangleRing(bed.geometry).map(([lng, lat]) => [lat, lng] as [number, number]);
        const planted = plants.filter((plant) => plant.bed_id === bed.id);
        const colour = planted.length ? bySlug.get(planted[0].flower_slug)?.colour ?? "#f7d5dc" : "#fffaf4";
        const polygon = L.polygon(ring, {
          color: "#3f5c49",
          weight: 2,
          fillColor: colour,
          fillOpacity: planted.length ? 0.78 : 0.35,
        }).addTo(group);
        polygon.bindTooltip(bedLabel(bed, planted, bySlug, units), {
          permanent: true,
          direction: "center",
          className: "bed-label",
        });
        polygon.on("click", () => {
          const slug = selectedRef.current;
          if (!slug) return;
          const already = plants.some((plant) => plant.bed_id === bed.id && plant.flower_slug === slug);
          void (already ? unassignFlower(farm.id, bed.id, slug) : assignFlower(farm.id, bed.id, slug)).then(() =>
            router.refresh(),
          );
        });
      }
      if (draft) {
        const ring = rectangleRing(draft).map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polygon(ring, { color: "#d9899a", weight: 2, fillColor: "#f7d5dc", fillOpacity: 0.45, dashArray: "4 4" }).addTo(
          group,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [beds, plants, boundary, outline, draft, bySlug, farm.id, router, units, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (mode === "bed") map.dragging.disable();
    else map.dragging.enable();
    const container = map.getContainer();
    let start: LngLat | null = null;
    const toLngLat = (event: MouseEvent): LngLat => {
      const rect = container.getBoundingClientRect();
      const latlng = map.containerPointToLatLng([event.clientX - rect.left, event.clientY - rect.top]);
      return [latlng.lng, latlng.lat];
    };
    const down = (event: MouseEvent) => {
      if (modeRef.current !== "bed") return;
      if (event.button !== 0) return;
      start = toLngLat(event);
      map.dragging.disable();
      event.preventDefault();
    };
    const move = (event: MouseEvent) => {
      if (!start || modeRef.current !== "bed") return;
      const next = rectangleFromCorners(start, toLngLat(event));
      if (next) setDraft(next);
    };
    const up = () => {
      start = null;
    };
    container.addEventListener("pointerdown", down, true);
    container.addEventListener("mousedown", down, true);
    window.addEventListener("pointermove", move);
    window.addEventListener("mousemove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("mouseup", up);
    return () => {
      container.removeEventListener("pointerdown", down, true);
      container.removeEventListener("mousedown", down, true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("mouseup", up);
    };
  }, [mode, mapReady]);

  async function searchPlace(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
    const body = await response.json();
    const hit = body.hits?.[0];
    if (!hit || !mapRef.current) {
      setMessage("No place matched that. Try a postcode, like EH1.");
      return;
    }
    mapRef.current.flyTo([hit.latitude, hit.longitude], 17);
    setMessage(`Centred on ${hit.label}. Draw the outline from here.`);
  }

  async function closeOutline() {
    if (outline.length < 3) {
      setMessage("An outline needs at least three corners.");
      return;
    }
    const polygon: FarmBoundary = { type: "Polygon", coordinates: [closeRing(outline)] };
    setBusy(true);
    const result = await saveFarmBoundary(farm.id, polygon);
    setBusy(false);
    if (result && "error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    setOutline([]);
    setMode("move");
    setMessage("Outline saved. Beds you draw inside it use the real ground.");
    router.refresh();
  }

  async function clearOutline() {
    setOutline([]);
    setBusy(true);
    await saveFarmBoundary(farm.id, null);
    setBusy(false);
    router.refresh();
  }

  async function keepBed() {
    if (!draft) return;
    setBusy(true);
    const result = await saveMappedBed(farm.id, {
      name: bedName || `Bed ${beds.length + 1}`,
      bedKind,
      geometry: draft,
    });
    setBusy(false);
    if ("error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    setDraft(null);
    setBedName("");
    setMode("move");
    setMessage("Bed saved. It is the same bed as on the Beds page, with this measured size.");
    router.refresh();
  }

  async function rotateSaved(bed: BedRecord, delta: number) {
    if (!isBedRectangle(bed.geometry)) return;
    await updateMappedBed(farm.id, bed.id, withRotation(bed.geometry, bed.geometry.rotationDeg + delta));
    router.refresh();
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!dragging || !mapRef.current) return;
    const slug = dragging;
    setDragging(null);
    const map = mapRef.current;
    const rect = map.getContainer().getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      return;
    }
    const latlng = map.containerPointToLatLng([event.clientX - rect.left, event.clientY - rect.top]);
    const point: LngLat = [latlng.lng, latlng.lat];
    const hit = beds.find((bed) => isBedRectangle(bed.geometry) && pointInRing(point, rectangleRing(bed.geometry)));
    if (!hit) {
      setMessage("Drop onto a bed. The ground outside them doesn't get a plant count.");
      return;
    }
    void assignFlower(farm.id, hit.id, slug).then(() => router.refresh());
  }

  const draftArea = draft ? rectangleAreaM2(draft) : 0;
  const boundaryArea = boundary ? ringAreaM2(boundary.coordinates[0]) : outline.length >= 3 ? ringAreaM2(outline) : 0;

  return (
    <div className="space-y-3" onPointerUp={onPointerUp}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-4xl">Farm map</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Satellite pictures, then your outline, then the beds. Sizes are measured on the ground, and the plant counts use those metres.
          </p>
        </div>
        <form onSubmit={searchPlace} className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Postcode or town"
            className="h-11 w-48 rounded-full border border-input bg-card px-4 text-sm"
          />
          <button type="submit" className="h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground">
            Centre
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["move", "Move"],
            ["outline", "Draw outline"],
            ["bed", "Draw a bed"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={
              mode === value
                ? "h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground"
                : "h-11 rounded-full border border-border bg-card px-4 text-sm"
            }
          >
            {label}
          </button>
        ))}
        {mode === "outline" ? (
          <>
            <button type="button" className="h-11 rounded-full border border-border px-4 text-sm" onClick={() => setOutline((current) => current.slice(0, -1))}>
              Undo point
            </button>
            <button type="button" className="h-11 rounded-full bg-accent px-4 text-sm" disabled={busy} onClick={() => void closeOutline()}>
              Close outline
            </button>
          </>
        ) : null}
        {boundary ? (
          <button type="button" className="h-11 rounded-full border border-border px-4 text-sm" onClick={() => void clearOutline()}>
            Clear outline
          </button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {mode === "outline"
          ? "Tap each corner of the land. Then close the outline."
          : mode === "bed"
            ? "Drag across the ground for a bed. Then set the angle and keep it."
            : "Drag the map. Tap a flower, then a bed — or drag the flower onto it."}
        {boundaryArea > 0 ? ` Outline about ${formatSquareMetres(boundaryArea)}.` : ""}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
        <div ref={node} className="z-0 h-[68dvh] min-h-80 w-full touch-none" />
      </div>

      {draft ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
          <label className="text-sm">
            Name
            <input
              value={bedName}
              onChange={(event) => setBedName(event.target.value)}
              placeholder={`Bed ${beds.length + 1}`}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </label>
          <label className="text-sm">
            Kind
            <select
              value={bedKind}
              onChange={(event) => setBedKind(event.target.value as typeof bedKind)}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
            >
              <option value="annual">Annual rotation</option>
              <option value="perennial">Permanent</option>
              <option value="bulb">Bulbs</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Angle, clockwise from north: {Math.round(draft.rotationDeg)}°
            <input
              type="range"
              min={0}
              max={180}
              value={draft.rotationDeg}
              onChange={(event) => setDraft(withRotation(draft, Number(event.target.value)))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </label>
          <p className="text-sm sm:col-span-2">
            {draft.lengthM.toFixed(2)} m by {draft.widthM.toFixed(2)} m · {formatSquareMetres(draftArea)}
          </p>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" disabled={busy} onClick={() => void keepBed()} className="h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground">
              Keep this bed
            </button>
            <button type="button" onClick={() => setDraft(null)} className="h-11 rounded-full border border-border px-4 text-sm">
              Discard
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-sm font-medium">Plantings</p>
        {planned.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Add flowers to the plan first. The map only plants what you've already chosen.</p>
        ) : (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {planned.map((flower) => (
              <button
                key={flower.slug}
                type="button"
                onPointerDown={() => setDragging(flower.slug)}
                onClick={() => setSelected(flower.slug)}
                className={
                  selected === flower.slug
                    ? "shrink-0 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "shrink-0 rounded-full border border-border bg-card px-3 py-2 text-sm"
                }
              >
                <span className="mr-2 inline-block size-2 rounded-full" style={{ background: flower.colour }} />
                {flower.commonName}
              </button>
            ))}
          </div>
        )}
      </div>

      {beds.some((bed) => isBedRectangle(bed.geometry)) ? (
        <ul className="space-y-2 text-sm">
          {beds.filter((bed) => isBedRectangle(bed.geometry)).map((bed) => {
            const geometry = bed.geometry as BedRectangle;
            const planted = plants.filter((plant) => plant.bed_id === bed.id);
            return (
              <li key={bed.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <span>
                  <strong>{bed.name}</strong> · {formatLength(bed.length_cm, units)} by {formatLength(bed.width_cm, units)}
                  {planted.length
                    ? ` · ${planted
                        .map((plant) => {
                          const flower = bySlug.get(plant.flower_slug);
                          if (!flower) return plant.flower_slug;
                          const count = plantCount(bed.length_cm, bed.width_cm, flower.spacingCm, flower.rowSpacingCm);
                          return `${flower.commonName} ${count.total}`;
                        })
                        .join(", ")}`
                    : " · empty"}
                </span>
                <span className="flex gap-2">
                  <button type="button" className="underline" onClick={() => void rotateSaved(bed, -15)}>
                    Turn −15°
                  </button>
                  <button type="button" className="underline" onClick={() => void rotateSaved(bed, 15)}>
                    Turn +15°
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

function bedLabel(
  bed: BedRecord,
  planted: BedPlantRecord[],
  bySlug: Map<string, Flower>,
  units: Units,
): string {
  const lines = [`<strong>${bed.name}</strong>`, `${formatLength(bed.length_cm, units)} × ${formatLength(bed.width_cm, units)}`];
  for (const plant of planted) {
    const flower = bySlug.get(plant.flower_slug);
    if (!flower) continue;
    const count = plantCount(bed.length_cm, bed.width_cm, flower.spacingCm, flower.rowSpacingCm);
    lines.push(`${flower.commonName}: ${count.total}`);
  }
  return lines.join("<br>");
}
