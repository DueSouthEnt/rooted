const METRES_PER_FOOT = 0.3048;

export type LayoutUnit = "ft" | "m";

export function toMetres(value: number, unit: LayoutUnit): number {
  return unit === "ft" ? value * METRES_PER_FOOT : value;
}

export function fromMetres(metres: number, unit: LayoutUnit): number {
  return unit === "ft" ? metres / METRES_PER_FOOT : metres;
}

export type LatLng = { latitude: number; longitude: number };

export type LaidBed = {
  index: number;
  /** Centre of the bed, metres along the block (positive toward the far end). */
  alongM: number;
  /** Centre of the bed, metres across the block. */
  acrossM: number;
  lengthM: number;
  widthM: number;
};

export type BedLayout = {
  bedCount: number;
  bedLengthM: number;
  bedWidthM: number;
  pathWidthM: number;
  /** True when the dragged length is shorter than the bed length the user set. */
  clipped: boolean;
  usedWidthM: number;
  beds: LaidBed[];
};

/**
 * Pack parallel beds across a dragged rectangle.
 * Paths sit only between beds. Beds are centred in the rectangle.
 * Length is the requested bed length, clipped to the drag when the drag is shorter.
 */
export function layoutBeds(input: {
  spanLengthM: number;
  spanWidthM: number;
  bedLength: number;
  bedWidth: number;
  pathWidth: number;
  unit: LayoutUnit;
}): BedLayout {
  const bedWidthM = Math.max(0, toMetres(input.bedWidth, input.unit));
  const pathWidthM = Math.max(0, toMetres(input.pathWidth, input.unit));
  const requestedLengthM = Math.max(0, toMetres(input.bedLength, input.unit));
  const spanLengthM = Math.max(0, input.spanLengthM);
  const spanWidthM = Math.max(0, input.spanWidthM);
  const pitch = bedWidthM + pathWidthM;
  let bedCount = 0;
  if (bedWidthM > 0 && spanWidthM + 1e-6 >= bedWidthM) {
    bedCount = Math.floor((spanWidthM + pathWidthM) / pitch + 1e-6);
  }
  const usedWidthM = bedCount > 0 ? bedCount * bedWidthM + (bedCount - 1) * pathWidthM : 0;
  const lengthM = Math.min(requestedLengthM, spanLengthM);
  const clipped = requestedLengthM > spanLengthM + 0.05;
  const beds: LaidBed[] = [];
  const origin = -usedWidthM / 2;
  for (let index = 0; index < bedCount; index += 1) {
    // Bed 1 sits on the start edge. Numbers then run the other way, which reads upward along the block.
    const slot = bedCount - 1 - index;
    beds.push({
      index,
      alongM: 0,
      acrossM: origin + bedWidthM / 2 + slot * pitch,
      lengthM,
      widthM: bedWidthM,
    });
  }
  return { bedCount, bedLengthM: lengthM, bedWidthM, pathWidthM, clipped, usedWidthM, beds };
}

/** Width needed so a block holds exactly `count` beds. */
export function spanWidthForCount(count: number, bedWidth: number, pathWidth: number, unit: LayoutUnit): number {
  const bedWidthM = toMetres(bedWidth, unit);
  const pathWidthM = toMetres(pathWidth, unit);
  if (count <= 0) return 0;
  return count * bedWidthM + Math.max(0, count - 1) * pathWidthM;
}

/** Local metres to east/north. Rotation is degrees clockwise from north. */
export function rotateMetres(alongM: number, acrossM: number, rotationDeg: number): { eastM: number; northM: number } {
  const radians = (rotationDeg * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  return {
    eastM: alongM * sin + acrossM * cos,
    northM: alongM * cos - acrossM * sin,
  };
}

/** Inverse of rotateMetres. */
export function unrotateMetres(eastM: number, northM: number, rotationDeg: number): { alongM: number; acrossM: number } {
  const radians = (rotationDeg * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  return {
    alongM: eastM * sin + northM * cos,
    acrossM: eastM * cos - northM * sin,
  };
}

export function deltaMetres(origin: LatLng, point: LatLng): { eastM: number; northM: number } {
  const latRad = (origin.latitude * Math.PI) / 180;
  return {
    eastM: (point.longitude - origin.longitude) * 111_320 * Math.cos(latRad),
    northM: (point.latitude - origin.latitude) * 111_320,
  };
}

export function offsetLatLng(origin: LatLng, eastM: number, northM: number): LatLng {
  const latRad = (origin.latitude * Math.PI) / 180;
  return {
    latitude: origin.latitude + northM / 111_320,
    longitude: origin.longitude + eastM / (111_320 * Math.cos(latRad)),
  };
}

export function rectangleRing(
  center: LatLng,
  spanLengthM: number,
  spanWidthM: number,
  rotationDeg: number,
): LatLng[] {
  const halfL = spanLengthM / 2;
  const halfW = spanWidthM / 2;
  const corners: [number, number][] = [
    [-halfL, -halfW],
    [halfL, -halfW],
    [halfL, halfW],
    [-halfL, halfW],
  ];
  return corners.map(([along, across]) => {
    const { eastM, northM } = rotateMetres(along, across, rotationDeg);
    return offsetLatLng(center, eastM, northM);
  });
}

export function bedRing(center: LatLng, bed: LaidBed, rotationDeg: number): LatLng[] {
  const shifted = rotateMetres(bed.alongM, bed.acrossM, rotationDeg);
  return rectangleRing(offsetLatLng(center, shifted.eastM, shifted.northM), bed.lengthM, bed.widthM, rotationDeg);
}

export function ringAreaM2(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const origin = ring[0];
  const cos = Math.cos((origin.latitude * Math.PI) / 180);
  const xy = ring.map((point) => ({
    x: (point.longitude - origin.longitude) * 111_320 * cos,
    y: (point.latitude - origin.latitude) * 111_320,
  }));
  let sum = 0;
  for (let index = 0; index < xy.length; index += 1) {
    const next = xy[(index + 1) % xy.length];
    sum += xy[index].x * next.y - next.x * xy[index].y;
  }
  return Math.abs(sum) / 2;
}

export function ringContains(ring: LatLng[], point: LatLng): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const yi = ring[i].latitude;
    const yj = ring[j].latitude;
    const xi = ring[i].longitude;
    const xj = ring[j].longitude;
    const intersect =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

type XY = { x: number; y: number };

function toXY(ring: LatLng[], origin: LatLng): XY[] {
  const cos = Math.cos((origin.latitude * Math.PI) / 180);
  return ring.map((point) => ({
    x: (point.longitude - origin.longitude) * 111_320 * cos,
    y: (point.latitude - origin.latitude) * 111_320,
  }));
}

function project(poly: XY[], axis: XY): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of poly) {
    const value = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

/** True when two convex rings overlap, including when one sits inside the other. */
export function convexRingsOverlap(a: LatLng[], b: LatLng[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const origin = a[0];
  const pa = toXY(a, origin);
  const pb = toXY(b, origin);
  const polys = [pa, pb];
  for (const poly of polys) {
    for (let index = 0; index < poly.length; index += 1) {
      const next = poly[(index + 1) % poly.length];
      const axis = { x: -(next.y - poly[index].y), y: next.x - poly[index].x };
      const left = project(pa, axis);
      const right = project(pb, axis);
      if (left.max < right.min || right.max < left.min) return false;
    }
  }
  return true;
}

export function blockOutsideOutline(blockRing: LatLng[], outline: LatLng[]): boolean {
  if (outline.length < 3) return false;
  return blockRing.some((corner) => !ringContains(outline, corner));
}
