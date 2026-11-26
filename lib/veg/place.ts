import { looksLikeUkPostcode, nearestPlace, parseLatLng, ukPostcodeArea } from "@/lib/veg/geo";
import { FROST_LOCATIONS, type FrostLocation } from "@/lib/veg/seed/frost-locations";
import { POSTCODE_AREAS } from "@/lib/veg/seed/postcode-areas";

export type PlaceMatch = {
  label: string;
  latitude: number;
  longitude: number;
  location: FrostLocation;
  distanceKm: number;
};

export function matchPlace(query: string, locations = FROST_LOCATIONS): PlaceMatch | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const point = parseLatLng(trimmed);
  if (point) {
    const location = nearestPlace(point.latitude, point.longitude, locations);
    if (!location) return null;
    return {
      label: `${point.latitude.toFixed(2)}, ${point.longitude.toFixed(2)}`,
      latitude: point.latitude,
      longitude: point.longitude,
      location,
      distanceKm: 0,
    };
  }
  if (looksLikeUkPostcode(trimmed)) {
    const area = ukPostcodeArea(trimmed);
    const centroid = area ? POSTCODE_AREAS[area] : undefined;
    if (centroid) {
      const location = nearestPlace(centroid.latitude, centroid.longitude, locations);
      if (!location) return null;
      return {
        label: `${trimmed.toUpperCase()} (${centroid.town})`,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        location,
        distanceKm: 0,
      };
    }
  }
  const needle = trimmed.toLowerCase();
  const named = locations.find((place) => place.name.toLowerCase().includes(needle) || place.region.toLowerCase().includes(needle));
  if (named) {
    return { label: named.name, latitude: named.latitude, longitude: named.longitude, location: named, distanceKm: 0 };
  }
  const town = Object.entries(POSTCODE_AREAS).find(([, value]) => value.town.toLowerCase().includes(needle));
  if (!town) return null;
  const [, centroid] = town;
  const location = nearestPlace(centroid.latitude, centroid.longitude, locations);
  if (!location) return null;
  return {
    label: centroid.town,
    latitude: centroid.latitude,
    longitude: centroid.longitude,
    location,
    distanceKm: 0,
  };
}

export function searchPlaces(query: string, locations = FROST_LOCATIONS): FrostLocation[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return locations;
  return locations.filter(
    (place) =>
      place.name.toLowerCase().includes(needle) ||
      place.region.toLowerCase().includes(needle) ||
      place.country.toLowerCase().includes(needle),
  );
}
