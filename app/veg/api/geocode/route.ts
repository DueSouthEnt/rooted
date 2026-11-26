import { connection } from "next/server";
import { haversineKm, nearestPlace, parseLatLng } from "@/lib/veg/geo";
import { matchPlace, searchPlaces } from "@/lib/veg/place";
import { FROST_LOCATIONS } from "@/lib/veg/seed/frost-locations";

export type GeocodeHit = {
  label: string;
  latitude: number;
  longitude: number;
  frostId: string | null;
  frostName: string | null;
  distanceKm: number | null;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

function withFrost(latitude: number, longitude: number, label: string): GeocodeHit {
  const station = nearestPlace(latitude, longitude, FROST_LOCATIONS);
  return {
    label,
    latitude,
    longitude,
    frostId: station?.id ?? null,
    frostName: station?.name ?? null,
    distanceKm: station ? Math.round(haversineKm(latitude, longitude, station.latitude, station.longitude) * 10) / 10 : null,
  };
}

function localHits(query: string): GeocodeHit[] {
  const hits: GeocodeHit[] = [];
  const direct = matchPlace(query);
  if (direct) hits.push(withFrost(direct.latitude, direct.longitude, direct.label));
  for (const place of searchPlaces(query).slice(0, 5)) {
    const label = `${place.name}, ${place.region}`;
    if (hits.some((hit) => hit.label === label)) continue;
    hits.push(withFrost(place.latitude, place.longitude, label));
  }
  return hits.slice(0, 5);
}

function preferNearby(results: GeocodeHit[], bias: { latitude: number; longitude: number } | null): GeocodeHit[] {
  if (!bias) return results.slice(0, 5);
  const ranked = results
    .map((hit) => ({ hit, kilometres: haversineKm(bias.latitude, bias.longitude, hit.latitude, hit.longitude) }))
    .sort((left, right) => left.kilometres - right.kilometres);
  const nearby = ranked.filter((item) => item.kilometres < 200);
  return (nearby.length ? nearby : ranked).slice(0, 5).map((item) => item.hit);
}

function photonLabel(properties: PhotonFeature["properties"]): string {
  if (!properties) return "Unnamed place";
  const parts = [properties.name, properties.street, properties.city, properties.state, properties.postcode, properties.country].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((item) => item.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  return unique.slice(0, 4).join(", ") || "Unnamed place";
}

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const biasLat = Number(url.searchParams.get("lat"));
  const biasLon = Number(url.searchParams.get("lon"));
  const bias = Number.isFinite(biasLat) && Number.isFinite(biasLon) ? { latitude: biasLat, longitude: biasLon } : null;
  if (query.length < 2) return Response.json({ results: [] as GeocodeHit[], provider: "none" });

  const point = parseLatLng(query);
  if (point) {
    return Response.json({ results: [withFrost(point.latitude, point.longitude, query)], provider: "coordinates" });
  }

  try {
    const located = bias ? `&lat=${bias.latitude}&lon=${bias.longitude}` : "";
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en${located}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SproutLogic/0.1 (market garden planner; local use)",
      },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (response.ok) {
      const body = (await response.json()) as { features?: PhotonFeature[] };
      const results = (body.features ?? [])
        .map((feature) => {
          const [longitude, latitude] = feature.geometry?.coordinates ?? [];
          if (latitude == null || longitude == null) return null;
          return withFrost(latitude, longitude, photonLabel(feature.properties));
        })
        .filter((hit): hit is GeocodeHit => hit != null);
      if (results.length) return Response.json({ results: preferNearby(results, bias), provider: "photon" });
    }
  } catch {
    // Photon is a public service. A timeout falls through to the local UK list.
  }

  return Response.json({ results: localHits(query), provider: "local" });
}
