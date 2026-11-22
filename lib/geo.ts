/** Longitude, latitude. GeoJSON order. */
export type LngLat = [number, number];

export interface FarmBoundary {
  type: "Polygon";
  coordinates: [LngLat[]];
}

/** A bed block on the satellite map. Length runs along `rotationDeg`, clockwise from north. */
export interface BedRectangle {
  type: "rectangle";
  center: LngLat;
  lengthM: number;
  widthM: number;
  rotationDeg: number;
}

const EARTH_M = 6_378_137;

export function destination(lat: number, lng: number, bearingDeg: number, distanceM: number): LngLat {
  const bearing = ((bearingDeg % 360) + 360) % 360;
  const angular = distanceM / EARTH_M;
  const theta = (bearing * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(theta),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

export function haversineM(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function offset(lat: number, lng: number, bearingDeg: number, metres: number): LngLat {
  if (metres < 0) return destination(lat, lng, bearingDeg + 180, -metres);
  return destination(lat, lng, bearingDeg, metres);
}

/** Four corners, not closed. Length follows rotation clockwise from north. */
export function rectangleRing(bed: BedRectangle): LngLat[] {
  const [lng, lat] = bed.center;
  const along = bed.rotationDeg;
  const across = bed.rotationDeg + 90;
  const halfL = bed.lengthM / 2;
  const halfW = bed.widthM / 2;
  const signs: Array<[number, number]> = [
    [halfL, halfW],
    [halfL, -halfW],
    [-halfL, -halfW],
    [-halfL, halfW],
  ];
  return signs.map(([lengthOffset, widthOffset]) => {
    const [lng1, lat1] = offset(lat, lng, along, lengthOffset);
    return offset(lat1, lng1, across, widthOffset);
  });
}

export function rectangleAreaM2(bed: BedRectangle): number {
  return Math.abs(bed.lengthM * bed.widthM);
}

/** Axis-aligned rectangle from two dragged corners, length along the longer side. */
export function rectangleFromCorners(a: LngLat, b: LngLat): BedRectangle | null {
  const west = Math.min(a[0], b[0]);
  const east = Math.max(a[0], b[0]);
  const south = Math.min(a[1], b[1]);
  const north = Math.max(a[1], b[1]);
  const center: LngLat = [(west + east) / 2, (south + north) / 2];
  const eastWest = haversineM([west, center[1]], [east, center[1]]);
  const northSouth = haversineM([center[0], south], [center[0], north]);
  if (eastWest < 0.3 && northSouth < 0.3) return null;
  const lengthIsEast = eastWest >= northSouth;
  return {
    type: "rectangle",
    center,
    lengthM: roundM(Math.max(eastWest, northSouth)),
    widthM: roundM(Math.min(eastWest, northSouth)),
    rotationDeg: lengthIsEast ? 90 : 0,
  };
}

function roundM(value: number): number {
  return Math.round(value * 100) / 100;
}

export function withRotation(bed: BedRectangle, rotationDeg: number): BedRectangle {
  const wrapped = ((rotationDeg % 360) + 360) % 360;
  return { ...bed, rotationDeg: Math.round(wrapped * 10) / 10 };
}

export function toCentimetres(bed: BedRectangle): { lengthCm: number; widthCm: number } {
  return {
    lengthCm: Math.max(1, Math.round(bed.lengthM * 100)),
    widthCm: Math.max(1, Math.round(bed.widthM * 100)),
  };
}

export function ringAreaM2(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const [originLng, originLat] = ring[0];
  const metresPerLat = 111_320;
  const metresPerLng = 111_320 * Math.cos((originLat * Math.PI) / 180);
  const points = ring.map(([lng, lat]) => ({
    x: (lng - originLng) * metresPerLng,
    y: (lat - originLat) * metresPerLat,
  }));
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    sum += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(sum) / 2;
}

export function pointInRing(point: LngLat, ring: LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

export function isFarmBoundary(value: unknown): value is FarmBoundary {
  if (!value || typeof value !== "object") return false;
  const polygon = value as FarmBoundary;
  const ring = polygon.coordinates?.[0];
  return polygon.type === "Polygon" && Array.isArray(ring) && ring.length >= 4;
}

export function isBedRectangle(value: unknown): value is BedRectangle {
  if (!value || typeof value !== "object") return false;
  const bed = value as BedRectangle;
  return (
    bed.type === "rectangle" &&
    Array.isArray(bed.center) &&
    bed.center.length === 2 &&
    Number.isFinite(bed.lengthM) &&
    Number.isFinite(bed.widthM) &&
    Number.isFinite(bed.rotationDeg)
  );
}

export function formatSquareMetres(area: number): string {
  if (area >= 100) return `${Math.round(area)} m²`;
  if (area >= 10) return `${area.toFixed(1)} m²`;
  return `${area.toFixed(2)} m²`;
}

export const DEFAULT_SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export function satelliteTileUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SATELLITE_TILE_URL?.trim();
  return configured || DEFAULT_SATELLITE_TILES;
}
