"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import {
  Hand,
  Hexagon,
  Minus,
  MousePointer2,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide-react";
import type { Map as LeafletMap, LeafletMouseEvent } from "leaflet";
import { deleteBlockAction, deleteFarmAreaAction, saveDisplayUnitAction, saveFarmAreaAction, saveFrostSettingsAction, saveMapBlockAction } from "@/app/veg/actions";
import { Button } from "@/components/veg/ui/button";
import { Input } from "@/components/veg/ui/input";
import { assignPlantingBedsAction } from "@/app/veg/actions";
import { AddPlantingDialog } from "@/components/veg/plan/add-planting-dialog";
import { PlantingDragSurface } from "@/components/veg/plan/planting-drag";
import { PutOnBedDialog } from "@/components/veg/plan/put-on-bed";
import { gardenerBedName } from "@/lib/veg/bed-name";
import { bedLabelPx, bedNumbersToShow, labelsThatFit } from "@/lib/veg/bed-labels";
import { ukCropName } from "@/lib/veg/crop-names";
import { formatMedium } from "@/lib/veg/dates";
import {
  blockOutsideOutline,
  convexRingsOverlap,
  deltaMetres,
  displayLength,
  fromMetres,
  layoutBeds,
  offsetLatLng,
  pickMapShape,
  rectangleRing,
  ringAreaM2,
  ringContains,
  rotateMetres,
  spanWidthForCount,
  toMetres,
  unrotateMetres,
  type LatLng,
} from "@/lib/veg/bed-layout";
import { BLOCK_TYPE_LABEL } from "@/lib/veg/labels";
import type { MapTiles } from "@/lib/veg/map-tiles";
import type { FrostContext } from "@/lib/veg/queries";
import { availabilityFor, type BedOccupancy, type BedSlot } from "@/lib/veg/planting-form";
import type { BlockType, Unit } from "@/lib/veg/types";
import type { BlockView, CropView, FarmAreaView, PlantingView, TaskView } from "@/lib/veg/views";
import { cn } from "@/lib/veg/utils";

const SOIL = "#C4A06A";
const PATH = "#E6D3B8";
const CLAY = "#8C3B2A";
const INK = "#3A2A1A";
const WHEAT = "#E2B15A";
const LINEN = "#FFF8F1";

type Mode = "select" | "pan" | "outline" | "block";

type Preview = {
  center: LatLng;
  spanLengthM: number;
  spanWidthM: number;
  rotation: number;
  bedCount: number;
  clipped: boolean;
};

type Geom = {
  id: string;
  centerLat: number;
  centerLng: number;
  rotationDeg: number;
  spanLengthM: number;
  spanWidthM: number;
};

type Drag =
  | { kind: "draw"; start: LatLng; moved: boolean; latest: Preview | null }
  | {
      kind: "move" | "rotate" | "length" | "width";
      blockId: string;
      start: LatLng;
      origin: LatLng;
      rotation: number;
      spanLengthM: number;
      spanWidthM: number;
      moved: boolean;
    }
  | {
      kind: "move-area";
      areaId: string;
      name: string;
      start: LatLng;
      outline: [number, number][];
      latestOutline: [number, number][] | null;
      moved: boolean;
    };

type Setup = {
  name: string;
  type: BlockType;
  unit: Unit;
  bedLength: number;
  bedWidth: number;
  pathWidth: number;
  rotation: number;
};

type FarmPoint = {
  locationLabel: string;
  frostLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
  manualLastSpringFrost: string | null;
  manualFirstAutumnFrost: string | null;
  useManualFrost: boolean;
  displayUnit?: Unit;
};

type GeocodeHit = {
  label: string;
  latitude: number;
  longitude: number;
  frostId: string | null;
  frostName: string | null;
  distanceKm: number | null;
};

type SearchState = { label: string; hits: GeocodeHit[]; open: boolean };

function outlineRing(outline: [number, number][]): LatLng[] {
  return outline.map(([longitude, latitude]) => ({ latitude, longitude }));
}

function formatMeasure(m2: number): string {
  const hectares = m2 / 10_000;
  const acres = m2 / 4046.8564224;
  return `${Math.round(m2).toLocaleString("en-GB")} m² · ${hectares.toFixed(2)} ha · ${acres.toFixed(2)} acres`;
}

function blockArea(block: BlockView): number {
  if (block.spanLengthM != null && block.spanWidthM != null) return block.spanLengthM * block.spanWidthM;
  return 0;
}

function placementWarnings(block: BlockView, areas: FarmAreaView[], all: BlockView[], displayUnit: Unit): string[] {
  if (block.centerLat == null || block.centerLng == null || block.spanLengthM == null || block.spanWidthM == null) return [];
  const ring = rectangleRing(
    { latitude: block.centerLat, longitude: block.centerLng },
    block.spanLengthM,
    block.spanWidthM,
    block.rotationDeg ?? 0,
  );
  const warnings: string[] = [];
  const area = areas.find((item) => item.id === block.farmAreaId) ?? areas[0];
  if (area && blockOutsideOutline(ring, outlineRing(area.outline))) warnings.push("This block sits outside the farm outline.");
  for (const other of all) {
    if (other.id === block.id || other.centerLat == null || other.centerLng == null || other.spanLengthM == null || other.spanWidthM == null) continue;
    const otherRing = rectangleRing(
      { latitude: other.centerLat, longitude: other.centerLng },
      other.spanLengthM,
      other.spanWidthM,
      other.rotationDeg ?? 0,
    );
    if (convexRingsOverlap(ring, otherRing)) warnings.push(`Overlaps ${other.name}.`);
  }
  const layout = layoutBeds({
    spanLengthM: block.spanLengthM,
    spanWidthM: block.spanWidthM,
    bedLength: block.bedLength,
    bedWidth: block.bedWidth,
    pathWidth: block.pathWidth,
    unit: block.unit,
  });
  if (layout.clipped) {
    warnings.push(
      `Beds are clipped to ${displayLength(layout.bedLengthM, "m", displayUnit).toFixed(1)} ${displayUnit}. The length you set is ${displayLength(block.bedLength, block.unit, displayUnit).toFixed(1)} ${displayUnit}.`,
    );
  }
  return warnings;
}

function previewFromDrag(start: LatLng, end: LatLng, setup: Setup): Preview | null {
  const delta = deltaMetres(start, end);
  const local = unrotateMetres(delta.eastM, delta.northM, setup.rotation);
  const spanLengthM = Math.abs(local.alongM);
  const spanWidthM = Math.abs(local.acrossM);
  if (spanLengthM < 0.8 || spanWidthM < 0.4) return null;
  const center = offsetLatLng(start, ...pair(rotateMetres(local.alongM / 2, local.acrossM / 2, setup.rotation)));
  const layout = layoutBeds({
    spanLengthM,
    spanWidthM,
    bedLength: setup.bedLength,
    bedWidth: setup.bedWidth,
    pathWidth: setup.pathWidth,
    unit: setup.unit,
  });
  return { center, spanLengthM, spanWidthM, rotation: setup.rotation, bedCount: layout.bedCount, clipped: layout.clipped };
}

function pair(point: { eastM: number; northM: number }): [number, number] {
  return [point.eastM, point.northM];
}

export function SatelliteFarm({
  tiles,
  areas: initialAreas,
  blocks: initialBlocks,
  settings,
  plantings = [],
  crops = [],
  frost = null,
  season = new Date().getUTCFullYear(),
  today = "",
  tasks = [],
  standardBedLengthM = 15,
}: {
  tiles: MapTiles;
  areas: FarmAreaView[];
  blocks: BlockView[];
  settings: FarmPoint;
  plantings?: PlantingView[];
  crops?: CropView[];
  frost?: FrostContext | null;
  season?: number;
  today?: string;
  tasks?: TaskView[];
  standardBedLengthM?: number;
}) {
  const router = useRouter();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [areas, setAreas] = useState(initialAreas);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [mode, setMode] = useState<Mode>(initialAreas.length ? "select" : "outline");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(initialAreas[0]?.id ?? null);
  const [outlineDraft, setOutlineDraft] = useState<LatLng[]>([]);
  const [areaName, setAreaName] = useState(initialAreas.length ? "New field" : "Home field");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [override, setOverride] = useState<Geom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    settings.frostLocationId ? `Frost dates follow ${settings.locationLabel}.` : null,
  );
  const [search, setSearch] = useState<SearchState>({ label: "", hits: [], open: false });
  const [mobileList, setMobileList] = useState(false);
  const [zoom, setZoom] = useState(17);
  const [watchDate, setWatchDate] = useState(today);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [addingPlanting, setAddingPlanting] = useState(false);
  const [editingPlantingId, setEditingPlantingId] = useState<string | null>(null);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const bedRingsRef = useRef<{ id: string; ring: LatLng[] }[]>([]);
  const dragPlanting = useRef<string | null>(null);
  const toneRef = useRef(new Map<string, "free" | "clash" | "busy">());
  const cropFillRef = useRef(new Map<string, { color: string; name: string }>());
  const showCropsRef = useRef(true);
  const bedPolyRef = useRef(new Map<string, { setStyle: (style: object) => void; bindTooltip: (text: string, options: object) => void }>());
  const [showCrops, setShowCrops] = useState(true);
  const [mapRevision, setMapRevision] = useState(0);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<string | null>(null);
  showCropsRef.current = showCrops;
  const [displayUnit, setDisplayUnit] = useState<Unit>(() => readDisplayUnit(settings.displayUnit ?? "m"));
  const [setup, setSetup] = useState<Setup>(() => initialSetup(readDisplayUnit(settings.displayUnit ?? "m")));

  const stateRef = useRef({ areas, blocks, mode, setup, outlineDraft, selectedAreaId, selectedId });
  stateRef.current = { areas, blocks, mode, setup, outlineDraft, selectedAreaId, selectedId };
  const dragRef = useRef<Drag | null>(null);
  const pendingGeom = useRef<Geom | null>(null);
  const ignoreClick = useRef(false);
  const apiRef = useRef({
    saveOutline: (_id: string | undefined, _name: string, _outline: [number, number][]) => {},
    commitDrawn: (_preview: Preview) => {},
    commitGeometry: (_blockId: string, _geom: Omit<Geom, "id">) => {},
    removeBlock: (_id: string) => {},
    removeArea: (_id: string) => {},
  });

  useEffect(() => {
    setAreas(initialAreas);
    setBlocks(initialBlocks);
  }, [initialAreas, initialBlocks]);

  useEffect(() => {
    const query = search.label.trim();
    if (query.length < 2) return;
    const handle = window.setTimeout(async () => {
      const center = mapRef.current?.getCenter();
      const bias = center ? `&lat=${center.lat}&lon=${center.lng}` : "";
      const response = await fetch(`/veg/api/geocode?q=${encodeURIComponent(query)}${bias}`);
      if (!response.ok) return;
      const body = (await response.json()) as { results: GeocodeHit[] };
      setSearch((current) => (current.label.trim() === query ? { ...current, hits: body.results, open: true } : current));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [search.label]);

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    let stopGestures = () => {};
    const node = mapEl.current;
    if (!node) return;

    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !node) return;
      const L = leaflet.default;
      map = L.map(node, { zoomControl: false, attributionControl: true, doubleClickZoom: false, maxZoom: 22 });
      L.tileLayer(tiles.url, {
        attribution: tiles.attribution,
        maxZoom: 22,
        maxNativeZoom: tiles.maxZoom,
      }).addTo(map);
      L.control.scale({ metric: true, imperial: true, position: "bottomleft" }).addTo(map);
      mapRef.current = map;
      map.on("zoomend", () => setZoom(map?.getZoom() ?? 17));

      const { areas: knownAreas, blocks: knownBlocks, settings: point } = {
        areas: stateRef.current.areas,
        blocks: stateRef.current.blocks,
        settings,
      };
      const bounds = L.latLngBounds([]);
      for (const block of knownBlocks) {
        if (block.centerLat == null || block.centerLng == null || block.spanLengthM == null || block.spanWidthM == null) continue;
        for (const corner of rectangleRing(
          { latitude: block.centerLat, longitude: block.centerLng },
          block.spanLengthM,
          block.spanWidthM,
          block.rotationDeg ?? 0,
        )) {
          bounds.extend([corner.latitude, corner.longitude]);
        }
      }
      if (!bounds.isValid()) {
        for (const area of knownAreas) {
          for (const [longitude, latitude] of area.outline) bounds.extend([latitude, longitude]);
        }
      }
      const fitView = () => {
        if (cancelled || !map) return;
        map.invalidateSize();
        if (bounds.isValid()) map.fitBounds(bounds, { paddingTopLeft: [320, 80], paddingBottomRight: [48, 36], maxZoom: 19 });
        else map.setView([point.latitude ?? 55.9352, point.longitude ?? -3.2184], 16);
      };
      fitView();
      requestAnimationFrame(fitView);

      const toPoint = (latlng: { lat: number; lng: number }): LatLng => ({ latitude: latlng.lat, longitude: latlng.lng });

      const pointFromClient = (clientX: number, clientY: number): LatLng => {
        const latlng = map!.mouseEventToLatLng({ clientX, clientY } as MouseEvent);
        return { latitude: latlng.lat, longitude: latlng.lng };
      };
      const eventPoint = (event: Event): LatLng | null => {
        if ("touches" in event && (event as TouchEvent).touches.length > 0) {
          const touch = (event as TouchEvent).touches[0];
          return pointFromClient(touch.clientX, touch.clientY);
        }
        if ("clientX" in event) {
          const mouse = event as MouseEvent;
          return pointFromClient(mouse.clientX, mouse.clientY);
        }
        return null;
      };
      const publishMove = (here: LatLng) => {
        const drag = dragRef.current;
        if (!drag) return;
        if (drag.kind === "draw") {
          drag.moved = true;
          const next = previewFromDrag(drag.start, here, stateRef.current.setup);
          drag.latest = next;
          setPreview(next);
          return;
        }
        if (drag.kind === "move-area") {
          const delta = deltaMetres(drag.start, here);
          if (Math.hypot(delta.eastM, delta.northM) < 0.25) return;
          drag.moved = true;
          const outline = drag.outline.map(([longitude, latitude]) => {
            const next = offsetLatLng({ latitude, longitude }, delta.eastM, delta.northM);
            return [next.longitude, next.latitude] as [number, number];
          });
          drag.latestOutline = outline;
          setAreas((current) => current.map((area) => (area.id === drag.areaId ? { ...area, outline } : area)));
          return;
        }
        const block = stateRef.current.blocks.find((item) => item.id === drag.blockId);
        if (!block) return;
        const travel = deltaMetres(drag.start, here);
        if (drag.kind === "move" && Math.hypot(travel.eastM, travel.northM) < 0.25) return;
        drag.moved = true;
        const publish = (geom: Geom) => {
          pendingGeom.current = geom;
          setOverride(geom);
        };
        if (drag.kind === "move") {
          const center = offsetLatLng(drag.origin, travel.eastM, travel.northM);
          publish({
            id: drag.blockId,
            centerLat: center.latitude,
            centerLng: center.longitude,
            rotationDeg: drag.rotation,
            spanLengthM: drag.spanLengthM,
            spanWidthM: drag.spanWidthM,
          });
          return;
        }
        if (drag.kind === "rotate") {
          const delta = deltaMetres(drag.origin, here);
          publish({
            id: drag.blockId,
            centerLat: drag.origin.latitude,
            centerLng: drag.origin.longitude,
            rotationDeg: (Math.atan2(delta.eastM, delta.northM) * 180) / Math.PI,
            spanLengthM: drag.spanLengthM,
            spanWidthM: drag.spanWidthM,
          });
          return;
        }
        const local = unrotateMetres(deltaMetres(drag.origin, here).eastM, deltaMetres(drag.origin, here).northM, drag.rotation);
        const minimumWidth = toMetres(block.bedWidth, block.unit);
        publish({
          id: drag.blockId,
          centerLat: drag.origin.latitude,
          centerLng: drag.origin.longitude,
          rotationDeg: drag.rotation,
          spanLengthM: drag.kind === "length" ? Math.max(1, Math.abs(local.alongM) * 2) : drag.spanLengthM,
          spanWidthM: drag.kind === "width" ? Math.max(minimumWidth, Math.abs(local.acrossM) * 2) : drag.spanWidthM,
        });
      };
      const finishDrag = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;
        if (drag.moved) ignoreClick.current = true;
        const currentMode = stateRef.current.mode;
        if (currentMode === "select" || currentMode === "pan") map?.dragging.enable();
        if (drag.kind === "draw") {
          if (drag.latest && drag.latest.bedCount > 0) apiRef.current.commitDrawn(drag.latest);
          else setPreview(null);
          return;
        }
        if (drag.kind === "move-area") {
          if (drag.moved && drag.latestOutline) apiRef.current.saveOutline(drag.areaId, drag.name, drag.latestOutline);
          return;
        }
        if (!drag.moved) return;
        const live = pendingGeom.current;
        if (live && live.id === drag.blockId) {
          const { id, ...geom } = live;
          apiRef.current.commitGeometry(id, geom);
        }
      };
      const beginSelect = (event: Event) => {
        if (dragRef.current) {
          event.stopPropagation();
          return;
        }
        const current = stateRef.current;
        if (current.mode !== "select") return;
        const target = event.target as Element | null;
        if (target?.closest?.(".leaflet-control, .leaflet-marker-icon, .resize-handle")) return;
        if (target?.classList?.contains("resize-handle")) return;
        const point = eventPoint(event);
        if (!point || !map) return;
        const hit = pickMapShape(point, current.blocks, current.areas);
        if (!hit) return;
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        map.dragging.disable();
        if (hit.kind === "block") {
          const block = current.blocks.find((item) => item.id === hit.id);
          if (block?.centerLat == null || block.centerLng == null || block.spanLengthM == null || block.spanWidthM == null) return;
          const already = current.selectedId === block.id;
          setSelectedId(block.id);
          setSelectedAreaId(block.farmAreaId);
          setMode("select");
          if (already) {
            const bedHit = bedRingsRef.current.find((bed) => ringContains(bed.ring, point));
            setSelectedBedId(bedHit && block.beds.some((bed) => bed.id === bedHit.id) ? bedHit.id : null);
          } else setSelectedBedId(null);
          dragRef.current = {
            kind: "move",
            blockId: block.id,
            start: point,
            origin: { latitude: block.centerLat, longitude: block.centerLng },
            rotation: block.rotationDeg ?? 0,
            spanLengthM: block.spanLengthM,
            spanWidthM: block.spanWidthM,
            moved: false,
          };
          return;
        }
        const area = current.areas.find((item) => item.id === hit.id);
        if (!area) return;
        setSelectedAreaId(area.id);
        setSelectedId(null);
        setSelectedBedId(null);
        dragRef.current = {
          kind: "move-area",
          areaId: area.id,
          name: area.name,
          start: point,
          outline: area.outline,
          latestOutline: null,
          moved: false,
        };
      };
      const follow = (event: Event) => {
        if (!dragRef.current) return;
        if (event.type === "touchmove" && event.cancelable) event.preventDefault();
        const here = eventPoint(event);
        if (here) publishMove(here);
      };
      node.addEventListener("mousedown", beginSelect, true);
      node.addEventListener("touchstart", beginSelect, { capture: true, passive: false });
      window.addEventListener("mousemove", follow);
      window.addEventListener("touchmove", follow, { passive: false });
      window.addEventListener("mouseup", finishDrag);
      window.addEventListener("touchend", finishDrag);
      stopGestures = () => {
        node.removeEventListener("mousedown", beginSelect, true);
        node.removeEventListener("touchstart", beginSelect, true);
        window.removeEventListener("mousemove", follow);
        window.removeEventListener("touchmove", follow);
        window.removeEventListener("mouseup", finishDrag);
        window.removeEventListener("touchend", finishDrag);
      };

      map.on("mousedown", (event: LeafletMouseEvent) => {
        const current = stateRef.current;
        if (current.mode !== "block" || dragRef.current) return;
        const target = event.originalEvent.target as HTMLElement | null;
        if (target?.closest(".leaflet-marker-icon, .resize-handle")) return;
        map?.dragging.disable();
        dragRef.current = { kind: "draw", start: toPoint(event.latlng), moved: false, latest: null };
      });

      map.on("mouseup", finishDrag);

      map.on("click", (event: LeafletMouseEvent) => {
        if (ignoreClick.current) {
          ignoreClick.current = false;
          return;
        }
        const current = stateRef.current;
        if (current.mode !== "outline") return;
        const point = toPoint(event.latlng);
        const draft = current.outlineDraft;
        if (draft.length >= 3 && map) {
          const first = map.latLngToContainerPoint([draft[0].latitude, draft[0].longitude]);
          const here = map.latLngToContainerPoint(event.latlng);
          if (first.distanceTo(here) < 14) {
            apiRef.current.saveOutline(
              undefined,
              areaNameRef.current,
              draft.map((corner) => [corner.longitude, corner.latitude]),
            );
            return;
          }
        }
        setOutlineDraft([...draft, point]);
      });
    })();

    return () => {
      cancelled = true;
      stopGestures();
      map?.remove();
      mapRef.current = null;
    };
    // The map is created once. Later gestures read the latest state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles.attribution, tiles.maxZoom, tiles.url]);

  const areaNameRef = useRef(areaName);
  areaNameRef.current = areaName;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mode === "outline" || mode === "block") map.dragging.disable();
    else map.dragging.enable();
    map.getContainer().style.cursor = mode === "outline" || mode === "block" ? "crosshair" : "";
  }, [mode]);

  const toneStamp = useMemo(() => {
    const slots: BedSlot[] = blocks.flatMap((block) =>
      block.beds.map((bed) => ({ id: bed.id, label: bed.label, blockId: block.id, blockName: block.name, position: bed.position })),
    );
    const occupancy: BedOccupancy[] = plantings.flatMap((planting) =>
      planting.beds.map((bed) => ({
        plantingId: planting.id,
        plantingLabel: `${ukCropName(planting.cropName)} · ${planting.cultivar}`,
        bedId: bed.id,
        start: planting.fieldPlantingDate,
        end: planting.lastHarvestDate,
      })),
    );
    const armed = plantings.find((planting) => planting.id === armedId);
    const start = armed?.fieldPlantingDate ?? watchDate;
    const end = armed?.lastHarvestDate ?? watchDate;
    if (!start || !end) {
      toneRef.current = new Map();
      return "";
    }
    const marks = availabilityFor(slots, occupancy, start, end, armed?.id);
    const next = new Map(marks.map((mark) => [mark.bedId, mark.status] as const));
    toneRef.current = armed ? next : new Map();
    const cropsOnDate = new Map<string, { color: string; name: string }>();
      for (const planting of plantings) {
      if (planting.fieldPlantingDate > watchDate || planting.lastHarvestDate < watchDate) continue;
      for (const bed of planting.beds) cropsOnDate.set(bed.id, { color: planting.color, name: ukCropName(planting.cropName) });
    }
    cropFillRef.current = showCrops ? cropsOnDate : new Map();
    const cropKey = [...cropsOnDate.entries()].map(([id, crop]) => `${id}:${crop.name}`).join("|");
    return `${showCrops ? "crops" : "outline"}|${armed ? "armed" : ""}|${cropKey}`;
  }, [armedId, blocks, plantings, showCrops, watchDate]);

  useEffect(() => {
    let cancelled = false;
    let group: { remove: () => void } | null = null;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const L = leaflet.default;
      const map = mapRef.current;
      const layer = L.layerGroup().addTo(map);
      group = layer;
      const bedHits: { id: string; ring: LatLng[] }[] = [];
      const cropCandidates: { id: string; x: number; y: number; w: number; h: number; name: string; lat: number; lng: number }[] = [];
      bedPolyRef.current = new Map();

      const drawBeds = (
        center: LatLng,
        spanLengthM: number,
        spanWidthM: number,
        rotation: number,
        spec: { bedLength: number; bedWidth: number; pathWidth: number; unit: Unit },
        labels: string[],
        bedIds: string[],
        names: string[],
        selected: boolean,
      ) => {
        const ring = rectangleRing(center, spanLengthM, spanWidthM, rotation);
        L.polygon(
          ring.map((point) => [point.latitude, point.longitude]),
          { color: CLAY, weight: selected ? 3 : 1.5, fillColor: PATH, fillOpacity: 0.92, interactive: false },
        ).addTo(layer);
        const layout = layoutBeds({ spanLengthM, spanWidthM, ...spec });
        const pitchPoint = offsetLatLng(center, ...pair(rotateMetres(0, layout.bedWidthM + layout.pathWidthM, rotation)));
        const pitchPx = map.latLngToContainerPoint([center.latitude, center.longitude]).distanceTo(
          map.latLngToContainerPoint([pitchPoint.latitude, pitchPoint.longitude]),
        );
        const labelPx = bedLabelPx(map.getZoom());
        const visible = new Set(bedNumbersToShow(layout.bedCount, pitchPx, labelPx + 6));
        layout.beds.forEach((bed, index) => {
          const shifted = rotateMetres(bed.alongM, bed.acrossM, rotation);
          const bedCenter = offsetLatLng(center, shifted.eastM, shifted.northM);
          const bedShape = rectangleRing(bedCenter, bed.lengthM, bed.widthM, rotation);
          const bedId = bedIds[index];
          const status = bedId ? toneRef.current.get(bedId) : undefined;
          const crop = bedId ? cropFillRef.current.get(bedId) : undefined;
          const empty = showCropsRef.current && !crop && !status;
          if (bedId) bedHits.push({ id: bedId, ring: bedShape });
          const poly = L.polygon(bedShape.map((point) => [point.latitude, point.longitude]), {
            className: empty ? "bed-empty" : "",
            color: status === "free" ? "#4E5C34" : status === "clash" ? "#7A2433" : INK,
            weight: status ? 3 : 1,
            fillColor: status === "clash" ? "#F8E6DC" : status === "free" ? "#E4EDD4" : crop ? crop.color : SOIL,
            fillOpacity: 0.92,
            interactive: false,
          }).addTo(layer);
          if (bedId) bedPolyRef.current.set(bedId, poly);
          if (names[index]) poly.bindTooltip(names[index], { sticky: true, direction: "top" });
          if (crop) {
            const point = map.latLngToContainerPoint([bedCenter.latitude, bedCenter.longitude]);
            const across = offsetLatLng(bedCenter, ...pair(rotateMetres(0, bed.widthM, rotation)));
            const along = offsetLatLng(bedCenter, ...pair(rotateMetres(bed.lengthM, 0, rotation)));
            const widthPx = Math.max(
              point.distanceTo(map.latLngToContainerPoint([across.latitude, across.longitude])),
              point.distanceTo(map.latLngToContainerPoint([along.latitude, along.longitude])),
            );
            const labelW = Math.min(96, Math.max(36, crop.name.length * 7));
            if (widthPx >= labelW) {
              cropCandidates.push({
                id: bedId ?? `${index}-${crop.name}`,
                x: point.x - labelW / 2,
                y: point.y - 9,
                w: labelW,
                h: 18,
                name: crop.name,
                lat: bedCenter.latitude,
                lng: bedCenter.longitude,
              });
            }
          }
          if (!visible.has(index)) return;
          const numberAt = offsetLatLng(center, ...pair(rotateMetres(-bed.lengthM / 2 - 1.4, bed.acrossM, rotation)));
          const label = labels[index] ?? String(index + 1);
          const number = label.match(/(\d+)$/)?.[1] ?? String(index + 1);
          const size = labelPx + 8;
          const spin = ((rotation % 360) + 360) % 360;
          const readable = spin > 90 && spin < 270 ? spin - 180 : spin;
          L.marker([numberAt.latitude, numberAt.longitude], {
            interactive: false,
            icon: L.divIcon({
              className: "bed-number",
              html: `<span style="font-size:${labelPx}px;height:${labelPx + 4}px;transform:rotate(${readable}deg)">${number}</span>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            }),
          }).addTo(layer);
        });
        return layout;
      };

      for (const area of areas) {
        const ring = outlineRing(area.outline);
        const polygon = L.polygon(
          ring.map((point) => [point.latitude, point.longitude]),
          {
            color: CLAY,
            weight: area.id === selectedAreaId ? 3 : 2,
            dashArray: "6 4",
            fillColor: WHEAT,
            fillOpacity: 0.14,
          },
        ).addTo(layer);
        polygon.on("click", (event) => {
          L.DomEvent.stopPropagation(event.originalEvent);
          setSelectedAreaId(area.id);
          setSelectedId(null);
          setSelectedBedId(null);
          setMode("select");
        });
        if (area.id === selectedAreaId && mode === "select") {
          const markers = ring.map((point) => {
            const marker = L.marker([point.latitude, point.longitude], {
              draggable: true,
              icon: L.divIcon({ className: "vertex-handle", iconSize: [28, 28], iconAnchor: [14, 14] }),
            }).addTo(layer);
            marker.on("mousedown", (event) => L.DomEvent.stopPropagation(event.originalEvent));
            marker.on("drag", () => {
              polygon.setLatLngs(markers.map((item) => item.getLatLng()));
            });
            marker.on("dragend", () => {
              apiRef.current.saveOutline(
                area.id,
                area.name,
                markers.map((item) => {
                  const latlng = item.getLatLng();
                  return [latlng.lng, latlng.lat] as [number, number];
                }),
              );
            });
            return marker;
          });
        }
      }

      if (outlineDraft.length) {
        L.polyline(
          outlineDraft.map((point) => [point.latitude, point.longitude]),
          { color: CLAY, weight: 2 },
        ).addTo(layer);
        if (outlineDraft.length >= 3) {
          L.polygon(
            outlineDraft.map((point) => [point.latitude, point.longitude]),
            { color: CLAY, weight: 2, fillColor: WHEAT, fillOpacity: 0.18 },
          ).addTo(layer);
        }
        for (const point of outlineDraft) {
          L.circleMarker([point.latitude, point.longitude], {
            radius: 5,
            color: CLAY,
            fillColor: LINEN,
            fillOpacity: 1,
            weight: 2,
          }).addTo(layer);
        }
      }

      for (const block of blocks) {
        const live = override?.id === block.id ? override : null;
        const centerLat = live?.centerLat ?? block.centerLat;
        const centerLng = live?.centerLng ?? block.centerLng;
        const spanLengthM = live?.spanLengthM ?? block.spanLengthM;
        const spanWidthM = live?.spanWidthM ?? block.spanWidthM;
        const rotation = live?.rotationDeg ?? block.rotationDeg ?? 0;
        if (centerLat == null || centerLng == null || spanLengthM == null || spanWidthM == null) continue;
        const center = { latitude: centerLat, longitude: centerLng };
        const selected = block.id === selectedId;
        drawBeds(
          center,
          spanLengthM,
          spanWidthM,
          rotation,
          block,
          block.beds.map((bed) => bed.label),
          block.beds.map((bed) => bed.id),
          block.beds.map((bed) => gardenerBedName(block.name, bed.position)),
          selected,
        );
        if (selected && mode === "select") {
          const handle = (kind: "rotate" | "length" | "width", at: LatLng) => {
            const marker = L.circleMarker([at.latitude, at.longitude], {
              radius: kind === "rotate" ? 16 : 14,
              className: "resize-handle",
              color: CLAY,
              fillColor: kind === "rotate" ? WHEAT : LINEN,
              fillOpacity: 1,
              weight: 2,
            }).addTo(layer);
            marker.on("mousedown", (event) => {
              L.DomEvent.stopPropagation(event.originalEvent);
              map.dragging.disable();
              dragRef.current = {
                kind,
                blockId: block.id,
                start: { latitude: event.latlng.lat, longitude: event.latlng.lng },
                origin: center,
                rotation,
                spanLengthM,
                spanWidthM,
                moved: false,
              };
            });
          };
          const spin = offsetLatLng(center, ...pair(rotateMetres(spanLengthM / 2 + 3, 0, rotation)));
          const lengthAt = offsetLatLng(center, ...pair(rotateMetres(spanLengthM / 2, 0, rotation)));
          const widthAt = offsetLatLng(center, ...pair(rotateMetres(0, spanWidthM / 2, rotation)));
          L.polyline(
            [
              [center.latitude, center.longitude],
              [spin.latitude, spin.longitude],
            ],
            { color: CLAY, weight: 1, dashArray: "2 3", interactive: false },
          ).addTo(layer);
          handle("length", lengthAt);
          handle("width", widthAt);
          handle("rotate", spin);
        }
      }

      if (preview && preview.bedCount > 0) {
        drawBeds(
          preview.center,
          preview.spanLengthM,
          preview.spanWidthM,
          preview.rotation,
          setup,
          [],
          [],
          [],
          true,
        );
      }
      const fitted = new Set(labelsThatFit(cropCandidates, 6));
      for (const candidate of cropCandidates) {
        if (!fitted.has(candidate.id)) continue;
        L.marker([candidate.lat, candidate.lng], {
          interactive: false,
          icon: L.divIcon({
            className: "crop-label",
            html: `<span>${candidate.name}</span>`,
            iconSize: [candidate.w, candidate.h],
            iconAnchor: [candidate.w / 2, candidate.h / 2],
          }),
        }).addTo(layer);
      }
      bedRingsRef.current = bedHits;
    })();
    return () => {
      cancelled = true;
      group?.remove();
    };
  }, [areas, blocks, outlineDraft, override, preview, selectedAreaId, selectedId, mode, setup, zoom, toneStamp, mapRevision]);

  async function saveOutline(id: string | undefined, name: string, outline: [number, number][]) {
    if (outline.length < 3) {
      setError("A farm outline needs at least three corners.");
      return;
    }
    const result = await saveFarmAreaAction({ id, name: name.trim() || "Farm area", outline });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const ring = outlineRing(outline);
    setAreas((current) => {
      const next = { id: result.data.id, name: name.trim() || "Farm area", outline, areaM2: ringAreaM2(ring) };
      const without = current.filter((area) => area.id !== next.id);
      return [...without, next];
    });
    setSelectedAreaId(result.data.id);
    setOutlineDraft([]);
    setMode("select");
    setError(null);
    router.refresh();
  }

  async function commitDrawn(next: Preview) {
    const name = setup.name.trim() || `Block ${blocks.length + 1}`;
    const containing = areas.find((area) => ringContains(outlineRing(area.outline), next.center));
    const result = await saveMapBlockAction({
      farmAreaId: containing?.id ?? selectedAreaId,
      name,
      type: setup.type,
      unit: "m",
      bedLength: toMetres(setup.bedLength, setup.unit),
      bedWidth: toMetres(setup.bedWidth, setup.unit),
      pathWidth: toMetres(setup.pathWidth, setup.unit),
      centerLat: next.center.latitude,
      centerLng: next.center.longitude,
      rotationDeg: next.rotation,
      spanLengthM: next.spanLengthM,
      spanWidthM: next.spanWidthM,
    });
    setPreview(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedId(result.data.id);
    setError(null);
    setNotice(result.data.warnings[0] ?? `${name} laid out ${next.bedCount} beds.`);
    setMode("select");
    router.refresh();
  }

  async function commitGeometry(blockId: string, geom: Omit<Geom, "id">) {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;
    setBlocks((current) =>
      current.map((item) =>
        item.id === blockId
          ? {
              ...item,
              centerLat: geom.centerLat,
              centerLng: geom.centerLng,
              rotationDeg: geom.rotationDeg,
              spanLengthM: geom.spanLengthM,
              spanWidthM: geom.spanWidthM,
            }
          : item,
      ),
    );
    setOverride(null);
    const containing = areas.find((area) =>
      ringContains(outlineRing(area.outline), { latitude: geom.centerLat, longitude: geom.centerLng }),
    );
    const result = await saveMapBlockAction({
      id: block.id,
      farmAreaId: containing?.id ?? block.farmAreaId,
      name: block.name,
      type: block.type,
      unit: block.unit,
      bedLength: block.bedLength,
      bedWidth: block.bedWidth,
      pathWidth: block.pathWidth,
      ...geom,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(result.data.warnings[0] ?? null);
    router.refresh();
  }

  apiRef.current = { saveOutline, commitDrawn, commitGeometry, removeBlock, removeArea };

  async function commitFields(patch: Partial<Setup & { bedCount: number; spanLengthM: number; spanWidthM: number }>) {
    const block = blocks.find((item) => item.id === selectedId);
    if (!block || block.centerLat == null || block.centerLng == null || block.spanLengthM == null || block.spanWidthM == null) return;
    const unit = patch.unit ?? block.unit;
    const bedLength = patch.bedLength ?? block.bedLength;
    const bedWidth = patch.bedWidth ?? block.bedWidth;
    const pathWidth = patch.pathWidth ?? block.pathWidth;
    const rotationDeg = patch.rotation ?? block.rotationDeg ?? 0;
    const dimensions = patch.bedLength != null || patch.bedWidth != null || patch.pathWidth != null || patch.bedCount != null || patch.spanLengthM != null;
    const spanLengthM = patch.spanLengthM ?? (dimensions ? bedLength : block.spanLengthM);
    const bedCount = Math.max(1, patch.bedCount ?? (block.beds.length || 1));
    const spanWidthM = patch.spanWidthM ?? (dimensions ? spanWidthForCount(bedCount, bedWidth, pathWidth, unit) : block.spanWidthM);
    const centerLat = override?.id === block.id ? override.centerLat : block.centerLat;
    const centerLng = override?.id === block.id ? override.centerLng : block.centerLng;
    setBlocks((current) =>
      current.map((item) =>
        item.id === block.id ? { ...item, unit, bedLength, bedWidth, pathWidth, spanLengthM, spanWidthM, rotationDeg } : item,
      ),
    );
    setOverride({ id: block.id, centerLat, centerLng, rotationDeg, spanLengthM, spanWidthM });
    const result = await saveMapBlockAction({
      id: block.id,
      farmAreaId: block.farmAreaId,
      name: patch.name?.trim() || block.name,
      type: patch.type ?? block.type,
      unit,
      bedLength,
      bedWidth,
      pathWidth,
      centerLat,
      centerLng,
      rotationDeg,
      spanLengthM,
      spanWidthM,
      bedCount: patch.bedCount,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(result.data.warnings[0] ?? null);
    router.refresh();
  }

  async function choosePlace(hit: GeocodeHit) {
    setSearch({ label: hit.label, hits: [], open: false });
    mapRef.current?.flyTo([hit.latitude, hit.longitude], 17);
    const result = await saveFrostSettingsAction({
      locationLabel: hit.label,
      frostLocationId: hit.frostId,
      latitude: hit.latitude,
      longitude: hit.longitude,
      manualLastSpringFrost: settings.manualLastSpringFrost,
      manualFirstAutumnFrost: settings.manualFirstAutumnFrost,
      useManualFrost: settings.useManualFrost,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(
      hit.frostName
        ? `Map is at ${hit.label}. Frost dates now follow ${hit.frostName}${hit.distanceKm != null ? ` (${hit.distanceKm} km)` : ""}.`
        : `Map is at ${hit.label}.`,
    );
    if (!areas.length) setMode("outline");
  }

  async function removeBlock(id: string) {
    const result = await deleteBlockAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBlocks((current) => current.filter((block) => block.id !== id));
    setSelectedId(null);
    router.refresh();
  }

  async function removeArea(id: string) {
    const result = await deleteFarmAreaAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAreas((current) => current.filter((area) => area.id !== id));
    setSelectedAreaId(null);
    router.refresh();
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (event.target as HTMLElement | null)?.isContentEditable) return;
      const current = stateRef.current;
      const block = current.blocks.find((item) => item.id === current.selectedId);
      if (event.key === "Delete" || event.key === "Backspace") {
        if (block) {
          event.preventDefault();
          void apiRef.current.removeBlock(block.id);
        } else if (current.selectedAreaId) {
          event.preventDefault();
          void apiRef.current.removeArea(current.selectedAreaId);
        }
        return;
      }
      const step = event.shiftKey ? 2 : 0.5;
      const direction: Record<string, [number, number] | undefined> = {
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      };
      const delta = direction[event.key];
      if (!delta) return;
      if (block?.centerLat != null && block.centerLng != null && block.spanLengthM != null && block.spanWidthM != null) {
        event.preventDefault();
        const next = offsetLatLng({ latitude: block.centerLat, longitude: block.centerLng }, delta[0], delta[1]);
        void apiRef.current.commitGeometry(block.id, {
          centerLat: next.latitude,
          centerLng: next.longitude,
          rotationDeg: block.rotationDeg ?? 0,
          spanLengthM: block.spanLengthM,
          spanWidthM: block.spanWidthM,
        });
        return;
      }
      const area = current.areas.find((item) => item.id === current.selectedAreaId);
      if (!area) return;
      event.preventDefault();
      const outline = area.outline.map(([longitude, latitude]) => {
        const moved = offsetLatLng({ latitude, longitude }, delta[0], delta[1]);
        return [moved.longitude, moved.latitude] as [number, number];
      });
      void apiRef.current.saveOutline(area.id, area.name, outline);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function commitMeasured(patch: { bedLength?: number; bedWidth?: number; pathWidth?: number; bedCount?: number; spanLengthM?: number }) {
    const block = blocks.find((item) => item.id === selectedId);
    if (!block) return;
    void commitFields({
      unit: "m",
      bedLength: patch.bedLength != null ? toMetres(patch.bedLength, displayUnit) : toMetres(block.bedLength, block.unit),
      bedWidth: patch.bedWidth != null ? toMetres(patch.bedWidth, displayUnit) : toMetres(block.bedWidth, block.unit),
      pathWidth: patch.pathWidth != null ? toMetres(patch.pathWidth, displayUnit) : toMetres(block.pathWidth, block.unit),
      bedCount: patch.bedCount,
      spanLengthM: patch.spanLengthM != null ? toMetres(patch.spanLengthM, displayUnit) : undefined,
    });
  }

  function chooseDisplayUnit(unit: Unit) {
    setDisplayUnit(unit);
    setSetup((current) => ({
      ...current,
      unit,
      bedLength: round1(fromMetres(toMetres(current.bedLength, current.unit), unit)),
      bedWidth: round1(fromMetres(toMetres(current.bedWidth, current.unit), unit)),
      pathWidth: round1(fromMetres(toMetres(current.pathWidth, current.unit), unit)),
    }));
    try {
      window.localStorage.setItem("veg-display-unit", unit);
    } catch {
      // The map still switches. The preference just stays for this visit.
    }
    void saveDisplayUnitAction(unit);
  }

  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const shown = selected
    ? {
        ...selected,
        centerLat: override?.id === selected.id ? override.centerLat : selected.centerLat,
        centerLng: override?.id === selected.id ? override.centerLng : selected.centerLng,
        rotationDeg: override?.id === selected.id ? override.rotationDeg : selected.rotationDeg,
        spanLengthM: override?.id === selected.id ? override.spanLengthM : selected.spanLengthM,
        spanWidthM: override?.id === selected.id ? override.spanWidthM : selected.spanWidthM,
      }
    : null;
  const warnings = shown ? placementWarnings(shown, areas, blocks, displayUnit) : [];
  const selectedBedRecord = blocks.flatMap((block) => block.beds.map((bed) => ({ bed, block }))).find((item) => item.bed.id === selectedBedId) ?? null;
  const selectedBed = selectedBedRecord
    ? {
        ...selectedBedRecord,
        succession: plantings
          .filter((planting) => planting.beds.some((bed) => bed.id === selectedBedRecord.bed.id))
          .sort((a, b) => a.fieldPlantingDate.localeCompare(b.fieldPlantingDate)),
        current:
          plantings.find(
            (planting) =>
              planting.beds.some((bed) => bed.id === selectedBedRecord.bed.id) &&
              planting.fieldPlantingDate <= watchDate &&
              planting.lastHarvestDate >= watchDate,
          ) ?? null,
      }
    : null;
  const draftArea = outlineDraft.length >= 3 ? ringAreaM2(outlineDraft) : 0;

  const unassigned = plantings.filter((planting) => planting.beds.length === 0);
  const legendCrops = [...new Map([...cropFillRef.current.values()].map((crop) => [crop.name, crop.color])).entries()].map(
    ([name, color]) => ({ name, color }),
  );
  const mapSlots: BedSlot[] = blocks.flatMap((block) =>
    block.beds.map((bed) => ({
      id: bed.id,
      label: gardenerBedName(block.name, bed.position),
      blockId: block.id,
      blockName: block.name,
      position: bed.position,
    })),
  );
  const mapOccupancy: BedOccupancy[] = plantings.flatMap((planting) =>
    planting.beds.map((bed) => ({
      plantingId: planting.id,
      plantingLabel: `${ukCropName(planting.cropName)} · ${planting.cultivar}`,
      bedId: bed.id,
      start: planting.fieldPlantingDate,
      end: planting.lastHarvestDate,
    })),
  );

  function paintMapBeds(id: string) {
    const planting = plantings.find((item) => item.id === id);
    if (!planting) return;
    const marks = availabilityFor(mapSlots, mapOccupancy, planting.fieldPlantingDate, planting.lastHarvestDate, planting.id);
    for (const mark of marks) {
      bedPolyRef.current.get(mark.bedId)?.setStyle({
        color: mark.status === "free" ? "#4E5C34" : "#7A2433",
        weight: 3,
        fillColor: mark.status === "free" ? "#E4EDD4" : "#F8E6DC",
        fillOpacity: 0.95,
      });
    }
  }

  async function dropPlanting(plantingId: string, bedId: string) {
    const result = await assignPlantingBedsAction(plantingId, bedId);
    setArmedId(null);
    if (!result.ok) setAssignMessage(result.error);
    else {
      setAssignMessage(null);
      router.refresh();
    }
  }

  function nudge(delta: number) {
    if (shown && mode === "select") {
      void commitFields({ rotation: Math.round((shown.rotationDeg ?? 0) + delta) });
      return;
    }
    setSetup((current) => ({ ...current, rotation: Math.round(current.rotation + delta) }));
  }

  return (
    <div className="farm-map relative -mx-4 -my-6 h-[calc(100dvh-4.25rem)] overflow-hidden bg-[#d7c4a8] lg:-mx-8 lg:-my-8">
      <div ref={mapEl} data-testid="farm-map" className="absolute inset-0 touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-sm">
          <ToolButton label="Select" pressed={mode === "select"} onClick={() => setMode("select")} testId="tool-select">
            <MousePointer2 />
          </ToolButton>
          <ToolButton label="Pan" pressed={mode === "pan"} onClick={() => setMode("pan")} testId="tool-pan">
            <Hand />
          </ToolButton>
          <ToolButton label="Draw outline" pressed={mode === "outline"} onClick={() => { setMode("outline"); setSelectedId(null); }} testId="tool-outline">
            <Hexagon />
          </ToolButton>
          <ToolButton label="Draw block" pressed={mode === "block"} onClick={() => setMode("block")} testId="tool-block">
            <RectangleHorizontal />
          </ToolButton>
          <span className="mx-1 h-6 w-px bg-border" />
          <ToolButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()} testId="tool-zoom-in">
            <Plus />
          </ToolButton>
          <ToolButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()} testId="tool-zoom-out">
            <Minus />
          </ToolButton>
          <ToolButton label="Rotate left" onClick={() => nudge(-5)} testId="tool-rotate-left">
            <RotateCcw />
          </ToolButton>
          <ToolButton label="Rotate right" onClick={() => nudge(5)} testId="tool-rotate-right">
            <RotateCw />
          </ToolButton>
        </div>
      </div>

      {preview ? (
        <div
          data-testid="bed-preview"
          className="absolute top-16 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-soil px-3 py-1.5 text-xs text-[#f6efe4] shadow"
        >
          {preview.bedCount} bed{preview.bedCount === 1 ? "" : "s"} fit ·{" "}
          {fromMetres(preview.spanLengthM, setup.unit).toFixed(1)} × {fromMetres(preview.spanWidthM, setup.unit).toFixed(1)} {setup.unit}
          {preview.clipped ? " · shorter than the bed length you set" : ""}
        </div>
      ) : null}

      <aside
        data-testid="farm-tree"
        className={cn(
          "absolute top-16 left-3 z-[500] flex w-[min(20rem,calc(100%-1.5rem))] flex-col gap-3 overflow-auto rounded-xl border border-border bg-card/95 p-3 shadow-sm",
          "max-h-[calc(100%-5rem)]",
          mobileList || areas.length === 0 ? "flex" : "hidden lg:flex",
        )}
      >
        <div>
          <p className="font-display text-lg leading-none text-foreground">Farm map</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Search for the farm, draw its outline, then drag a rectangle. Beds fill that patch.
          </p>
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Place or postcode
          <Input
            data-testid="place-search"
            value={search.label}
            placeholder="Bampton, or EX16 9NT"
            onChange={(event) => setSearch({ label: event.target.value, hits: [], open: true })}
            onFocus={() => setSearch((current) => ({ ...current, open: current.hits.length > 0 }))}
          />
        </label>
        {search.open && search.hits.length > 0 ? (
          <ul data-testid="place-results" className="grid gap-1">
            {search.hits.map((hit) => (
              <li key={`${hit.label}-${hit.latitude}`}>
                <button
                  type="button"
                  className="place-result w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => void choosePlace(hit)}
                >
                  <span className="block text-foreground">{hit.label}</span>
                  {hit.frostName ? (
                    <span className="block text-xs text-muted-foreground">
                      Nearest frost station: {hit.frostName}
                      {hit.distanceKm != null ? ` · ${hit.distanceKm} km` : ""}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {notice ? <p className="text-xs leading-5 text-muted-foreground">{notice}</p> : null}
        <div className="grid gap-2 rounded-lg bg-muted/50 p-2" data-testid="crop-legend">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Crops on the map</p>
            <Button type="button" size="sm" data-testid="map-add-planting" onClick={() => setAddingPlanting(true)}>
              Add planting
            </Button>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant={showCrops ? "default" : "outline"} data-testid="show-crops" onClick={() => setShowCrops(true)}>
              Show crops
            </Button>
            <Button type="button" size="sm" variant={showCrops ? "outline" : "default"} data-testid="outline-only" onClick={() => setShowCrops(false)}>
              Outline only
            </Button>
          </div>
          <Input data-testid="map-date" type="date" value={watchDate} onChange={(event) => setWatchDate(event.target.value)} />
          <input
            data-testid="map-date-slider"
            type="range"
            min={0}
            max={diffYearDays(season)}
            value={sliderValue(watchDate, season)}
            aria-label="Day of the season"
            onChange={(event) => setWatchDate(dateFromOffset(season, Number(event.target.value)))}
          />
          <p className="text-[11px] leading-4 text-muted-foreground">
            Each bed is coloured with the crop in it on this day. Zoom in for the crop name. Hover a bed for its number.
          </p>
          <ul className="flex flex-wrap gap-2">
            {legendCrops.map((crop) => (
              <li key={crop.name} className="flex items-center gap-1 text-[11px]">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: crop.color }} />
                {crop.name}
              </li>
            ))}
          </ul>
          {assignMessage ? <p className="text-xs text-warning-foreground">{assignMessage}</p> : null}
          {unassigned.map((planting) => (
            <PlantingDragSurface
              key={planting.id}
              id={planting.id}
              label={ukCropName(planting.cropName)}
              detail={planting.cultivar}
              testId={`map-unassigned-${planting.id}`}
              onDragStart={(id) => {
                dragPlanting.current = id;
                paintMapBeds(id);
              }}
              onDragEnd={() => {
                dragPlanting.current = null;
                setMapRevision((value) => value + 1);
              }}
              onDrop={(id, point) => {
                const map = mapRef.current;
                if (!map) return;
                const rect = map.getContainer().getBoundingClientRect();
                if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return;
                const latlng = map.containerPointToLatLng([point.x - rect.left, point.y - rect.top]);
                const hit = bedRingsRef.current.find((bed) => ringContains(bed.ring, { latitude: latlng.lat, longitude: latlng.lng }));
                if (hit) void dropPlanting(id, hit.id);
              }}
              onActivate={(id) => setPickerId(id)}
            />
          ))}
        </div>

        {mode === "outline" ? (
          <div className="grid gap-2 rounded-lg bg-muted/60 p-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {areas.length ? "New area name" : "Farm name"}
              <Input data-testid="outline-name" value={areaName} onChange={(event) => setAreaName(event.target.value)} />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              Click each corner. Click the first point again to close the outline. Drag a corner afterwards to reshape it.
            </p>
            {draftArea > 0 ? (
              <p data-testid="outline-area" className="num text-sm text-foreground">
                {formatMeasure(draftArea)}
              </p>
            ) : null}
            <Button
              type="button"
              data-testid="outline-finish"
              disabled={outlineDraft.length < 3}
              onClick={() =>
                void saveOutline(
                  undefined,
                  areaName,
                  outlineDraft.map((point) => [point.longitude, point.latitude]),
                )
              }
            >
              Close outline
            </Button>
            {outlineDraft.length > 0 ? (
              <Button type="button" variant="outline" onClick={() => setOutlineDraft((current) => current.slice(0, -1))}>
                Undo last point
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2">
          {areas.map((area) => {
            const children = blocks.filter((block) => block.farmAreaId === area.id);
            return (
              <div key={area.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left",
                    selectedAreaId === area.id && !selectedId ? "bg-wheat/40" : "hover:bg-muted",
                  )}
                  onClick={() => {
                    setSelectedAreaId(area.id);
                    setSelectedId(null);
                    const map = mapRef.current;
                    if (!map || area.outline.length === 0) return;
                    const leafletBounds = area.outline.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
                    void import("leaflet").then((leaflet) => {
                      map.fitBounds(leaflet.default.latLngBounds(leafletBounds), {
                        paddingTopLeft: [300, 70],
                        paddingBottomRight: [40, 30],
                        maxZoom: 18,
                      });
                    });
                  }}
                >
                  <span className="text-sm font-medium text-foreground">{area.name}</span>
                  <span className="num text-[11px] text-muted-foreground">{Math.round(area.areaM2).toLocaleString("en-GB")} m²</span>
                </button>
                <ul className="ml-2 border-l border-border pl-2">
                  {children.map((block) => (
                    <li key={block.id}>
                      <button
                        type="button"
                        data-testid={`tree-block-${block.id}`}
                        className={cn(
                          "flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-1 text-left",
                          selectedId === block.id ? "bg-wheat/50" : "hover:bg-muted",
                        )}
                        onClick={() => {
                          setSelectedId(block.id);
                          setSelectedAreaId(area.id);
                          setMode("select");
                          if (block.centerLat != null && block.centerLng != null) {
                            mapRef.current?.panTo([block.centerLat, block.centerLng]);
                          }
                        }}
                      >
                        <span className="text-sm text-foreground">{block.name}</span>
                        <span className="num text-[11px] text-muted-foreground">
                          {block.beds.length} beds · {Math.round(blockArea(block)).toLocaleString("en-GB")} m²
                        </span>
                      </button>
                    </li>
                  ))}
                  {children.length === 0 ? <li className="px-2 py-1 text-xs text-muted-foreground">No blocks yet</li> : null}
                </ul>
                {selectedAreaId === area.id && children.length === 0 ? (
                  <button type="button" className="mt-1 px-2 text-xs text-clay" onClick={() => void removeArea(area.id)}>
                    Delete empty area
                  </button>
                ) : null}
              </div>
            );
          })}
          {blocks.some((block) => !block.farmAreaId) ? (
            <div>
              <p className="px-2 text-xs text-muted-foreground">Not in an area</p>
              {blocks
                .filter((block) => !block.farmAreaId)
                .map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    className="flex w-full justify-between px-2 py-1 text-left text-sm"
                    onClick={() => setSelectedId(block.id)}
                  >
                    {block.name}
                    <span className="text-xs text-muted-foreground">{block.beds.length} beds</span>
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </aside>

      <button
        type="button"
        className="absolute bottom-3 left-3 z-[500] rounded-lg bg-card px-3 py-1.5 text-sm shadow lg:hidden"
        onClick={() => setMobileList((open) => !open)}
      >
        {mobileList ? "Hide areas" : "Farm areas"}
      </button>

      {mode === "block" ? (
        <aside data-testid="bed-setup" className="absolute top-16 right-3 z-[500] grid w-[min(20rem,calc(100%-1.5rem))] gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-sm">
          <div>
            <p className="font-display text-lg leading-none">Beds before you draw</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Set the bed and the path, then drag a rectangle. Parallel beds fill it. Paths sit between the beds.
            </p>
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Block name
            <Input value={setup.name} placeholder="North slope" onChange={(event) => setSetup({ ...setup, name: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Block type
            <select
              data-testid="setup-type"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={setup.type}
              onChange={(event) => setSetup({ ...setup, type: event.target.value as BlockType })}
            >
              <option value="open_field">Field</option>
              <option value="greenhouse">Greenhouse</option>
              <option value="high_tunnel">Tunnel</option>
            </select>
          </label>
          <div className="flex gap-1">
            {(["m", "ft"] as const).map((unit) => (
              <Button
                key={unit}
                type="button"
                size="sm"
                variant={displayUnit === unit ? "default" : "outline"}
                data-testid={`setup-unit-${unit}`}
                onClick={() => chooseDisplayUnit(unit)}
              >
                {unit === "m" ? "Metres" : "Feet"}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Bed length" testId="setup-length" value={setup.bedLength} onChange={(bedLength) => setSetup({ ...setup, bedLength })} />
            <NumberField label="Bed width" testId="setup-width" value={setup.bedWidth} onChange={(bedWidth) => setSetup({ ...setup, bedWidth })} />
            <NumberField label="Path width" testId="setup-path" value={setup.pathWidth} onChange={(pathWidth) => setSetup({ ...setup, pathWidth })} />
          </div>
          <NumberField
            label="Rotation (degrees)"
            testId="setup-rotation"
            value={setup.rotation}
            onChange={(rotation) => setSetup({ ...setup, rotation })}
          />
          <p className="text-xs text-muted-foreground">
            Drag across the field. A live count shows how many beds fit. If the drag is shorter than the bed length, the beds are clipped and the map says so.
          </p>
        </aside>
      ) : null}

      {selectedBed && mode !== "block" ? (
        <aside data-testid="bed-panel" className="absolute top-16 right-3 z-[500] grid max-h-[calc(100%-5.5rem)] w-[min(20rem,calc(100%-1.5rem))] gap-3 overflow-auto rounded-xl border border-border bg-card/95 p-3 shadow-sm">
          <div>
            <p className="font-display text-lg leading-none">{gardenerBedName(selectedBed.block.name, selectedBed.bed.position)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedBed.block.name}</p>
            {selectedBed.bed.sharedBedId ? (
              <p className="mt-2 text-xs text-muted-foreground">Shared with the flower beds. One outline, both kinds of planting.</p>
            ) : null}
          </div>
          <p className="text-sm">
            {selectedBed.current
              ? `${ukCropName(selectedBed.current.cropName)} · ${selectedBed.current.cultivar} is in this bed on ${formatMedium(watchDate)}.`
              : `Nothing is in this bed on ${formatMedium(watchDate)}.`}
          </p>
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">This year</p>
            <ul className="mt-2 grid gap-1">
              {selectedBed.succession.length === 0 ? <li className="text-sm text-muted-foreground">No plantings on this bed.</li> : null}
              {selectedBed.succession.map((planting) => (
                <li key={planting.id}>
                  <button
                    type="button"
                    data-testid={`map-planting-${planting.id}`}
                    className="w-full rounded-md px-1 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => setEditingPlantingId(planting.id)}
                  >
                    <span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: planting.color }} />
                    {formatMedium(planting.fieldPlantingDate)} – {formatMedium(planting.lastHarvestDate)} · {ukCropName(planting.cropName)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <Button type="button" variant="outline" onClick={() => setSelectedBedId(null)}>
            Close
          </Button>
        </aside>
      ) : null}
      {shown && mode !== "block" && !selectedBed ? (
        <aside data-testid="block-detail" className="absolute top-16 right-3 z-[500] grid max-h-[calc(100%-5.5rem)] w-[min(20rem,calc(100%-1.5rem))] gap-3 overflow-auto rounded-xl border border-border bg-card/95 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg leading-none">Block</p>
              <p className="mt-1 num text-xs text-muted-foreground">
                {shown.spanLengthM != null && shown.spanWidthM != null
                  ? `${displayLength(shown.spanLengthM, "m", displayUnit).toFixed(1)} × ${displayLength(shown.spanWidthM, "m", displayUnit).toFixed(1)} ${displayUnit}`
                  : "Not placed on the map"}
                {shown.spanLengthM != null && shown.spanWidthM != null ? ` · ${Math.round(shown.spanLengthM * shown.spanWidthM).toLocaleString("en-GB")} m²` : ""}
              </p>
            </div>
            <Button type="button" variant="outline" size="icon" aria-label="Delete block" data-testid="block-delete" onClick={() => void removeBlock(shown.id)}>
              <Trash2 />
            </Button>
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Name
            <Input data-testid="block-name" defaultValue={shown.name} key={shown.id} onBlur={(event) => void commitFields({ name: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Type
            <select
              data-testid="block-type"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={shown.type}
              onChange={(event) => void commitFields({ type: event.target.value as BlockType })}
            >
              {(Object.keys(BLOCK_TYPE_LABEL) as BlockType[]).map((type) => (
                <option key={type} value={type}>
                  {type === "open_field" ? "Field" : type === "high_tunnel" ? "Tunnel" : "Greenhouse"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1">
            {(["m", "ft"] as const).map((unit) => (
              <Button
                key={unit}
                type="button"
                size="sm"
                variant={displayUnit === unit ? "default" : "outline"}
                data-testid={`block-unit-${unit}`}
                onClick={() => chooseDisplayUnit(unit)}
              >
                {unit === "m" ? "Metres" : "Feet"}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Shown in {displayUnit === "m" ? "metres" : "feet"}. Saved in metres.</p>
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label="Bed length"
              testId="block-bed-length"
              value={round1(displayLength(shown.bedLength, shown.unit, displayUnit))}
              onChange={(bedLength) => void commitMeasured({ bedLength, spanLengthM: bedLength })}
            />
            <NumberField
              label="Bed width"
              testId="block-bed-width"
              value={round1(displayLength(shown.bedWidth, shown.unit, displayUnit))}
              onChange={(bedWidth) => void commitMeasured({ bedWidth })}
            />
            <NumberField
              label="Path width"
              testId="block-path-width"
              value={round1(displayLength(shown.pathWidth, shown.unit, displayUnit))}
              onChange={(pathWidth) => void commitMeasured({ pathWidth })}
            />
          </div>
          <NumberField
            label="Number of beds"
            testId="block-bed-count"
            value={shown.beds.length}
            onChange={(bedCount) => void commitMeasured({ bedCount: Math.max(1, Math.round(bedCount)) })}
          />
          <NumberField
            label="Rotation (degrees)"
            testId="block-rotation"
            value={Math.round(shown.rotationDeg ?? 0)}
            onChange={(rotation) => void commitFields({ rotation })}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Drag the block to move it. The wheat handle rotates it, and the linen handles change length and width. Arrow keys nudge it. Delete removes it.
          </p>
          {warnings.length > 0 ? (
            <ul data-testid="block-warnings" className="grid gap-1 rounded-lg bg-warning px-2 py-2 text-xs text-warning-foreground">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </aside>
      ) : null}

      {error ? (
        <p data-testid="map-error" className="absolute bottom-3 left-1/2 z-[500] max-w-md -translate-x-1/2 rounded-lg bg-warning px-3 py-2 text-sm text-warning-foreground shadow">
          {error}
        </p>
      ) : null}
      <PutOnBedDialog
        planting={plantings.find((item) => item.id === pickerId) ?? null}
        beds={mapSlots}
        occupancy={mapOccupancy}
        open={Boolean(pickerId)}
        onOpenChange={(open) => {
          if (!open) setPickerId(null);
        }}
      />
      <AddPlantingDialog
        key={editingPlantingId ?? (addingPlanting ? "new" : "closed")}
        open={addingPlanting || Boolean(editingPlantingId)}
        onOpenChange={(open) => {
          if (!open) {
            setAddingPlanting(false);
            setEditingPlantingId(null);
          }
        }}
        editing={plantings.find((item) => item.id === editingPlantingId) ?? null}
        tasks={tasks}
        crops={crops}
        season={season}
        today={today || watchDate}
        frost={frost}
        defaultBedLengthM={standardBedLengthM}
      />
    </div>
  );
}

function diffYearDays(season: number): number {
  const start = Date.UTC(season, 0, 1);
  const end = Date.UTC(season, 11, 31);
  return Math.round((end - start) / 86_400_000);
}

function sliderValue(iso: string, season: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return 0;
  const date = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const start = Date.UTC(season, 0, 1);
  return Math.min(diffYearDays(season), Math.max(0, Math.round((date - start) / 86_400_000)));
}

function dateFromOffset(season: number, offset: number): string {
  const date = new Date(Date.UTC(season, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function readDisplayUnit(fallback: Unit): Unit {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem("veg-display-unit");
    if (saved === "m" || saved === "ft") return saved;
  } catch {
    // Keep the unit that came from the farm.
  }
  return fallback;
}

function initialSetup(unit: Unit): Setup {
  const metres = { name: "", type: "open_field" as const, unit: "m" as const, bedLength: 30, bedWidth: 0.75, pathWidth: 0.45, rotation: 0 };
  if (unit === "m") return metres;
  return {
    ...metres,
    unit,
    bedLength: round1(fromMetres(metres.bedLength, unit)),
    bedWidth: round1(fromMetres(metres.bedWidth, unit)),
    pathWidth: round1(fromMetres(metres.pathWidth, unit)),
  };
}

function ToolButton({
  label,
  pressed,
  onClick,
  testId,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "default" : "ghost"}
      aria-label={label}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
    >
      {children}
      <span className="hidden xl:inline">{label}</span>
    </Button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        data-testid={testId}
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const next = Number(text);
          if (!Number.isFinite(next)) {
            setText(String(value));
            return;
          }
          onChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}
