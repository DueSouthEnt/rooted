import type { Station } from "@/data/stations";

export function normalisePlaceQuery(query: string): string {
  return query.trim().toUpperCase().replace(/\s+/g, "");
}

export function looksLikePostcode(query: string): boolean {
  const compact = normalisePlaceQuery(query);
  return /[A-Z]/.test(compact) && /\d/.test(compact);
}

/** Longest stored postcode prefix wins, so EH beats E and BS beats B. */
export function matchPostcode(stations: Station[], query: string): Station[] {
  const compact = normalisePlaceQuery(query);
  if (compact.length < 2) return [];

  let bestLength = 0;
  for (const station of stations) {
    for (const code of station.postalCodes) {
      const normalised = normalisePlaceQuery(code);
      if (normalised.length >= 1 && compact.startsWith(normalised)) {
        bestLength = Math.max(bestLength, normalised.length);
      }
    }
  }
  if (bestLength === 0) return [];

  return stations.filter((station) =>
    station.postalCodes.some((code) => {
      const normalised = normalisePlaceQuery(code);
      return compact.startsWith(normalised) && normalised.length === bestLength;
    }),
  );
}

export function searchStations(stations: Station[], query: string): Station[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const byName = stations.filter((station) => {
    const haystack = `${station.name} ${station.region} ${station.country}`.toLowerCase();
    return haystack.includes(trimmed);
  });
  const byPostcode = looksLikePostcode(query) ? matchPostcode(stations, query) : [];

  const seen = new Set<string>();
  const ordered = [...byPostcode, ...byName].filter((station) => {
    if (seen.has(station.id)) return false;
    seen.add(station.id);
    return true;
  });
  return ordered.slice(0, 8);
}

export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestStation(stations: Station[], latitude: number, longitude: number): Station {
  let best = stations[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const station of stations) {
    const distance = distanceKm(latitude, longitude, station.latitude, station.longitude);
    if (distance < bestDistance) {
      best = station;
      bestDistance = distance;
    }
  }
  return best;
}
