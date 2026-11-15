"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { assignFlower, saveBedBlock, saveFarmBoundary, saveMappedBed, unassignFlower, updateMappedBed } from "@/lib/actions";
import { plantCount } from "@/lib/beds";
import { bedIndexLabels, previewBlock, type BlockDraft } from "@/lib/blocks";
import { BloomMark } from "@/components/floral";
import { BlockPanel } from "@/components/block-panel";
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
import type { BedPlantRecord, BedRecord, BlockRecord, CropRecord, FarmRecord } from "@/lib/records";
import { formatLength, type Units } from "@/lib/units";

type Mode = "move" | "outline" | "bed" | "block";

export function FarmMap({
  farm,
  beds,
  blocks,
  plants,
  crops,
  flowers,
  units,
}: {
  farm: FarmRecord;
  beds: BedRecord[];
  blocks: BlockRecord[];
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
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockLength, setBlockLength] = useState(10);
  const [blockWidth, setBlockWidth] = useState(75);
  const [blockPath, setBlockPath] = useState(40);
  const [blockRotation, setBlockRotation] = useState(0);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
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
  const blockSpecRef = useRef({ length: blockLength, width: blockWidth, path: blockPath, rotation: blockRotation });
  const blocksRef = useRef(blocks);
  modeRef.current = mode;
  selectedRef.current = selected;
  blockSpecRef.current = { length: blockLength, width: blockWidth, path: blockPath, rotation: blockRotation };
  blocksRef.current = blocks;

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
      const labelled = new Map<string, Set<number>>();
      for (const block of blocks) labelled.set(block.id, new Set(bedIndexLabels(block.bed_count)));
      for (const bed of beds) {
        if (!isBedRectangle(bed.geometry)) continue;
        const ring = rectangleRing(bed.geometry).map(([lng, lat]) => [lat, lng] as [number, number]);
        const planted = plants.filter((plant) => plant.bed_id === bed.id);
        const colour = planted.length ? bySlug.get(planted[0].flower_slug)?.colour ?? "#f7d5dc" : "#fffaf4";
        const polygon = L.polygon(ring, {
          color: bed.block_id && bed.block_id === selectedBlock ? "#c45b86" : "#3f5c49",
          weight: bed.block_id && bed.block_id === selectedBlock ? 3 : 2,
          fillColor: colour,
          fillOpacity: planted.length ? 0.78 : 0.35,
        }).addTo(group);
        const inBlock = bed.block_id != null;
        const showIndex = inBlock && labelled.get(bed.block_id!)?.has(bed.block_index ?? 0);
        if (!inBlock) {
          polygon.bindTooltip(bedLabel(bed, planted, bySlug, units), {
            permanent: true,
            direction: "center",
            className: "bed-label",
          });
        } else if (showIndex && bed.geometry) {
          L.marker([bed.geometry.center[1], bed.geometry.center[0]], {
            interactive: false,
            icon: L.divIcon({
              className: "bed-index",
              html: `<span>${bed.block_index}</span>`,
              iconSize: [28, 18],
              iconAnchor: [14, 9],
            }),
          }).addTo(group);
        }
        polygon.on("click", () => {
          if (bed.block_id) setSelectedBlock(bed.block_id);
          const slug = selectedRef.current;
          if (!slug) return;
          const already = plants.some((plant) => plant.bed_id === bed.id && plant.flower_slug === slug);
          void (already ? unassignFlower(farm.id, bed.id, slug) : assignFlower(farm.id, bed.id, slug)).then(() =>
            router.refresh(),
          );
        });
      }
      if (blockDraft) {
        const marks = new Set(bedIndexLabels(blockDraft.count));
        blockDraft.beds.forEach((rectangle, index) => {
          const ring = rectangleRing(rectangle).map(([lng, lat]) => [lat, lng] as [number, number]);
          L.polygon(ring, { color: "#3f5c49", weight: 1.5, fillColor: "#e7f0e4", fillOpacity: 0.72 }).addTo(group);
          if (!marks.has(index + 1)) return;
          L.marker([rectangle.center[1], rectangle.center[0]], {
            interactive: false,
            icon: L.divIcon({
              className: "bed-index",
              html: `<span>${index + 1}</span>`,
              iconSize: [28, 18],
              iconAnchor: [14, 9],
            }),
          }).addTo(group);
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
  }, [beds, plants, blocks, boundary, outline, draft, blockDraft, selectedBlock, bySlug, farm.id, router, units, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (mode === "bed" || mode === "block") map.dragging.disable();
    else map.dragging.enable();
    const container = map.getContainer();
    let start: LngLat | null = null;
    let pending: BlockDraft | null = null;
    let saved = false;
    const toLngLat = (event: MouseEvent): LngLat => {
      const rect = container.getBoundingClientRect();
      const latlng = map.containerPointToLatLng([event.clientX - rect.left, event.clientY - rect.top]);
      return [latlng.lng, latlng.lat];
    };
    const down = (event: MouseEvent) => {
      const current = modeRef.current;
      if (current !== "bed" && current !== "block") return;
      if (event.button !== 0) return;
      start = toLngLat(event);
      pending = null;
      map.dragging.disable();
      event.preventDefault();
    };
    const move = (event: MouseEvent) => {
      if (!start) return;
      const current = toLngLat(event);
      if (modeRef.current === "bed") {
        const next = rectangleFromCorners(start, current);
        if (next) setDraft(next);
        return;
      }
      if (modeRef.current !== "block") return;
      const spec = blockSpecRef.current;
      pending = previewBlock(start, current, {
        rotationDeg: spec.rotation,
        bedLengthM: spec.length,
        bedWidthM: spec.width / 100,
        pathWidthM: spec.path / 100,
      });
      setBlockDraft(pending);
    };
    const up = () => {
      const drawn = pending;
      const origin = start;
      start = null;
      pending = null;
      if (saved || modeRef.current !== "block" || !drawn || !origin) return;
      saved = true;
      const name = `Block ${blocksRef.current.length + 1}`;
      void saveBedBlock(farm.id, {
        name,
        areaName: "Farm area",
        bedLengthM: drawn.bedLengthM,
        bedWidthCm: Math.round(drawn.bedWidthM * 100),
        pathWidthCm: Math.round(drawn.pathWidthM * 100),
        rotationDeg: drawn.rotationDeg,
        origin: drawn.origin,
        alongSign: drawn.alongSign,
        acrossSign: drawn.acrossSign,
        count: drawn.count,
        seasonYear: farm.season_year,
      }).then((result) => {
        setBlockDraft(null);
        setMode("move");
        if (result && "id" in result && result.id) setSelectedBlock(result.id);
        if (result && "error" in result && result.error) setMessage(result.error);
        else setMessage(`${name} saved as ${drawn.count} beds.`);
        router.refresh();
      });
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
  }, [mode, mapReady, farm.id, farm.season_year, router]);

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
  const activeBlock = blocks.find((block) => block.id === selectedBlock) ?? null;
  const areas = new Map<string, BlockRecord[]>();
  for (const block of blocks) {
    const list = areas.get(block.area_name) ?? [];
    list.push(block);
    areas.set(block.area_name, list);
  }
  if (areas.size === 0) areas.set("Farm area", []);
  const looseBeds = beds.filter((bed) => !bed.block_id && isBedRectangle(bed.geometry));

  return (
    <div className="space-y-3" onPointerUp={onPointerUp}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-2">
          <BloomMark bloom="cosmos" className="h-12 w-16 shrink-0" />
          <div>
            <h1 className="font-heading text-4xl">Farm map</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Satellite pictures, then your outline, then a single bed or a whole block of them. Sizes are measured on the ground.
            </p>
          </div>
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
            ["block", "Bed block"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              if (value === "block") setBlockOpen(true);
              else setMode(value);
            }}
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

      {blockOpen ? (
        <form
          className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setBlockOpen(false);
            setMode("block");
            setMessage("Drag across the ground. Sideways sets how many beds; along the rows sets their length.");
          }}
        >
          <p className="font-heading text-2xl sm:col-span-2">Bed block</p>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            A run of parallel beds with a path between each. The drag fills the rectangle. You can change the widths afterwards.
          </p>
          <label className="text-sm">
            Bed length (m)
            <input
              type="number"
              min={1}
              step={0.5}
              value={blockLength}
              onChange={(event) => setBlockLength(Number(event.target.value))}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </label>
          <label className="text-sm">
            Bed width (cm)
            <input
              type="number"
              min={20}
              step={1}
              value={blockWidth}
              onChange={(event) => setBlockWidth(Number(event.target.value))}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </label>
          <label className="text-sm">
            Path width (cm)
            <input
              type="number"
              min={0}
              step={1}
              value={blockPath}
              onChange={(event) => setBlockPath(Number(event.target.value))}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
            />
          </label>
          <label className="text-sm">
            Orientation, clockwise from north: {blockRotation}°
            <input
              type="range"
              min={0}
              max={180}
              value={blockRotation}
              onChange={(event) => setBlockRotation(Number(event.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground">
              Draw the block
            </button>
            <button type="button" className="h-11 rounded-full border border-border px-4 text-sm" onClick={() => setBlockOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {mode === "outline"
          ? "Tap each corner of the land. Then close the outline."
          : mode === "bed"
            ? "Drag across the ground for one bed. Then set the angle and keep it."
            : mode === "block"
              ? blockDraft
                ? `${blockDraft.count} beds, ${blockDraft.bedLengthM.toFixed(1)} m long, about ${formatSquareMetres(blockDraft.areaM2)}. Release to keep them.`
                : "Drag a rectangle. Beds pack across the short way, paths between them, numbered along the edge."
              : "Drag the map. Tap a flower, then a bed — or drag the flower onto it."}
        {boundaryArea > 0 ? ` Outline about ${formatSquareMetres(boundaryArea)}.` : ""}
      </p>

      <div className="grid items-start gap-3 xl:grid-cols-[200px_1fr_260px]">
        <aside className="rounded-2xl border border-border bg-card p-3 text-sm">
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Areas</p>
          {[...areas.entries()].map(([area, list]) => (
            <div key={area} className="mt-2">
              <p className="font-medium">{area}</p>
              {list.length === 0 ? <p className="text-muted-foreground">No blocks yet.</p> : null}
              <ul className="mt-1 space-y-1">
                {list.map((block) => (
                  <li key={block.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBlock(block.id);
                        const map = mapRef.current;
                        if (!map) return;
                        const members = beds.filter((bed) => bed.block_id === block.id && isBedRectangle(bed.geometry));
                        const points = members.flatMap((bed) =>
                          rectangleRing(bed.geometry as BedRectangle).map(([lng, lat]) => [lat, lng] as [number, number]),
                        );
                        if (points.length > 0) map.fitBounds(points, { padding: [28, 28], maxZoom: 19 });
                        else map.panTo([block.origin[1], block.origin[0]]);
                      }}
                      className={
                        selectedBlock === block.id ? "w-full rounded-lg bg-secondary px-2 py-1 text-left" : "w-full rounded-lg px-2 py-1 text-left hover:bg-secondary"
                      }
                    >
                      {block.name}
                      <span className="block text-xs text-muted-foreground">
                        {block.bed_count} beds · {formatSquareMetres(block.bed_length_m * (block.bed_count * (block.bed_width_cm / 100) + Math.max(0, block.bed_count - 1) * (block.path_width_cm / 100)))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {looseBeds.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">{looseBeds.length} single bed{looseBeds.length === 1 ? "" : "s"} outside a block.</p>
          ) : null}
        </aside>
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <div ref={node} className="z-0 h-[68dvh] min-h-80 w-full touch-none" />
        </div>
        {activeBlock ? <BlockPanel farmId={farm.id} block={activeBlock} /> : <div className="hidden xl:block" />}
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

      {blocks.length > 0 || looseBeds.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {blocks.map((block) => (
            <li key={block.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
              <button type="button" className="text-left" onClick={() => setSelectedBlock(block.id)}>
                <strong>{block.name}</strong> · {block.bed_count} beds · {block.bed_length_m.toFixed(1)} m by {block.bed_width_cm} cm
              </button>
            </li>
          ))}
          {looseBeds.map((bed) => {
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
