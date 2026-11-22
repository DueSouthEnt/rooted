import { NextResponse } from "next/server";
import { stations } from "@/data/stations";
import { searchStations } from "@/lib/places";

export const dynamic = "force-dynamic";

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  address?: { postcode?: string; country?: string; city?: string; town?: string; village?: string };
}

const cache = new Map<string, { at: number; hits: PlaceHit[] }>();

export interface PlaceHit {
  id: string;
  label: string;
  detail: string;
  latitude: number;
  longitude: number;
  postalCode: string | null;
  country: string | null;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ hits: [] });

  const local: PlaceHit[] = searchStations(stations, query).map((station) => ({
    id: `station:${station.id}`,
    label: station.name,
    detail: `${station.region}, ${station.country}`,
    latitude: station.latitude,
    longitude: station.longitude,
    postalCode: station.postalCodes[0] ?? null,
    country: station.country,
  }));

  let remote: PlaceHit[] = [];
  const cached = cache.get(query.toLowerCase());
  if (cached && Date.now() - cached.at < 1000 * 60 * 30) {
    remote = cached.hits;
  } else {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "5");
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Rooted/1.0 (cut-flower farm planner)",
          "Accept-Language": "en-GB",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const body = (await response.json()) as NominatimHit[];
        remote = body.map((hit, index) => ({
          id: `geo:${index}:${hit.lat}:${hit.lon}`,
          label: hit.address?.city || hit.address?.town || hit.address?.village || hit.display_name.split(",")[0],
          detail: hit.display_name,
          latitude: Number(hit.lat),
          longitude: Number(hit.lon),
          postalCode: hit.address?.postcode ?? null,
          country: hit.address?.country ?? null,
        }));
        cache.set(query.toLowerCase(), { at: Date.now(), hits: remote });
      }
    } catch {
      remote = [];
    }
  }

  const seen = new Set<string>();
  const hits = [...local, ...remote].filter((hit) => {
    const key = `${hit.latitude.toFixed(2)},${hit.longitude.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return NextResponse.json({ hits: hits.slice(0, 8) });
}
