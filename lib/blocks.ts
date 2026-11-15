import { destination, type BedRectangle, type LngLat } from "@/lib/geo";

export interface BlockSpec {
  /** How the beds run, degrees clockwise from north. */
  rotationDeg: number;
  /** Fallback length along each bed, in metres, if the drag is almost sideways. */
  bedLengthM: number;
  bedWidthM: number;
  pathWidthM: number;
}

export interface BlockDraft {
  origin: LngLat;
  rotationDeg: number;
  bedLengthM: number;
  bedWidthM: number;
  pathWidthM: number;
  count: number;
  alongSign: number;
  acrossSign: number;
  beds: BedRectangle[];
  /** Packed width across the beds, including paths. */
  spanM: number;
  areaM2: number;
}

/** How many whole beds, with a path between each, fit in a perpendicular span. */
export function bedsInSpan(spanM: number, bedWidthM: number, pathWidthM: number): number {
  if (bedWidthM <= 0 || spanM + 1e-6 < bedWidthM) return 0;
  const pitch = bedWidthM + Math.max(0, pathWidthM);
  return Math.max(0, Math.floor((spanM + Math.max(0, pathWidthM) + 1e-6) / pitch));
}

export function packedSpanM(count: number, bedWidthM: number, pathWidthM: number): number {
  if (count <= 0) return 0;
  return count * bedWidthM + Math.max(0, count - 1) * Math.max(0, pathWidthM);
}

/** 1, then every step, then the last. Step widens when there are lots of beds. */
export function bedIndexLabels(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 12) return Array.from({ length: count }, (_, index) => index + 1);
  const step = count > 32 ? 8 : 4;
  const labels = new Set<number>([1, count]);
  for (let number = step; number < count; number += step) labels.add(number);
  return [...labels].sort((a, b) => a - b);
}

function localMetres(origin: LngLat, point: LngLat): { east: number; north: number } {
  const metresPerDegree = 111_320;
  const [, originLat] = origin;
  return {
    east: (point[0] - origin[0]) * metresPerDegree * Math.cos((originLat * Math.PI) / 180),
    north: (point[1] - origin[1]) * metresPerDegree,
  };
}

export function projectDrag(origin: LngLat, current: LngLat, rotationDeg: number): { alongM: number; acrossM: number } {
  const { east, north } = localMetres(origin, current);
  const radians = (rotationDeg * Math.PI) / 180;
  return {
    alongM: north * Math.cos(radians) + east * Math.sin(radians),
    acrossM: east * Math.cos(radians) - north * Math.sin(radians),
  };
}

function shift(origin: LngLat, bearingDeg: number, metres: number): LngLat {
  if (Math.abs(metres) < 1e-6) return origin;
  const bearing = metres < 0 ? bearingDeg + 180 : bearingDeg;
  return destination(origin[1], origin[0], bearing, Math.abs(metres));
}

export function layoutBlockBeds(input: {
  origin: LngLat;
  rotationDeg: number;
  bedLengthM: number;
  bedWidthM: number;
  pathWidthM: number;
  count: number;
  alongSign: number;
  acrossSign: number;
}): BedRectangle[] {
  const beds: BedRectangle[] = [];
  const pitch = input.bedWidthM + Math.max(0, input.pathWidthM);
  for (let index = 0; index < input.count; index += 1) {
    const along = input.alongSign * (input.bedLengthM / 2);
    const across = input.acrossSign * (input.bedWidthM / 2 + index * pitch);
    const alongPoint = shift(input.origin, input.rotationDeg, along);
    const center = shift(alongPoint, input.rotationDeg + 90, across);
    beds.push({
      type: "rectangle",
      center,
      lengthM: round2(input.bedLengthM),
      widthM: round2(input.bedWidthM),
      rotationDeg: input.rotationDeg,
    });
  }
  return beds;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function previewBlock(origin: LngLat, current: LngLat, spec: BlockSpec): BlockDraft | null {
  const { alongM, acrossM } = projectDrag(origin, current, spec.rotationDeg);
  const acrossAbs = Math.abs(acrossM);
  const count = bedsInSpan(acrossAbs, spec.bedWidthM, spec.pathWidthM);
  if (count < 1) return null;
  const alongAbs = Math.abs(alongM);
  const bedLengthM = alongAbs >= 1 ? alongAbs : spec.bedLengthM;
  if (bedLengthM < 0.4) return null;
  const alongSign = alongM < 0 ? -1 : 1;
  const acrossSign = acrossM < 0 ? -1 : 1;
  const beds = layoutBlockBeds({
    origin,
    rotationDeg: spec.rotationDeg,
    bedLengthM,
    bedWidthM: spec.bedWidthM,
    pathWidthM: spec.pathWidthM,
    count,
    alongSign,
    acrossSign,
  });
  const spanM = packedSpanM(count, spec.bedWidthM, spec.pathWidthM);
  return {
    origin,
    rotationDeg: spec.rotationDeg,
    bedLengthM: round2(bedLengthM),
    bedWidthM: spec.bedWidthM,
    pathWidthM: spec.pathWidthM,
    count,
    alongSign,
    acrossSign,
    beds,
    spanM: round2(spanM),
    areaM2: round2(bedLengthM * spanM),
  };
}

export function reflowBlock(input: {
  origin: LngLat;
  rotationDeg: number;
  bedLengthM: number;
  bedWidthM: number;
  pathWidthM: number;
  count: number;
  alongSign: number;
  acrossSign: number;
}): BlockDraft {
  const beds = layoutBlockBeds(input);
  const spanM = packedSpanM(input.count, input.bedWidthM, input.pathWidthM);
  return {
    ...input,
    beds,
    spanM: round2(spanM),
    areaM2: round2(input.bedLengthM * spanM),
  };
}
