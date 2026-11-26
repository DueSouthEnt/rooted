export type GeoPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

const EARTH_KM = 6371;

export function haversineKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(latitudeB - latitudeA);
  const dLon = toRad(longitudeB - longitudeA);
  const lat1 = toRad(latitudeA);
  const lat2 = toRad(latitudeB);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestPlace<T extends GeoPoint>(latitude: number, longitude: number, places: T[]): T | null {
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const place of places) {
    const distance = haversineKm(latitude, longitude, place.latitude, place.longitude);
    if (distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}

export function parseLatLng(input: string): { latitude: number; longitude: number } | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/** Letters before the first digit: EH1 1YZ -> EH, SW1A 1AA -> SW, B1 1AA -> B. */
export function ukPostcodeArea(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, "");
  const match = compact.match(/^([A-Z]{1,2})\d/);
  return match ? match[1] : null;
}

export function looksLikeUkPostcode(input: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(input.trim()) || /^[A-Z]{1,2}\d/i.test(input.trim());
}
