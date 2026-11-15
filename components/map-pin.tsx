"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export function MapPin({
  latitude,
  longitude,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  onPickRef.current = onPick;

  useEffect(() => {
    const element = node.current;
    if (!element || mapRef.current) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || mapRef.current) return;
      const map = L.map(element).setView([54.5, -2.5], 5);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);
      map.on("click", (event) => {
        onPickRef.current(event.latlng.lat, event.latlng.lng);
      });
      setTimeout(() => map.invalidateSize(), 200);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (latitude == null || longitude == null) return;
    void import("leaflet").then((L) => {
      if (cancelled) return;
      const map = mapRef.current;
      if (!map) return;
      map.setView([latitude, longitude], Math.max(map.getZoom(), 8));
      if (!markerRef.current) {
        markerRef.current = L.circleMarker([latitude, longitude], {
          radius: 9,
          color: "#2f4a38",
          weight: 2,
          fillColor: "#b55233",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        markerRef.current.setLatLng([latitude, longitude]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div ref={node} className="z-0 h-64 w-full md:h-80" />
      <p className="bg-card px-3 py-2 text-xs text-muted-foreground">
        Tap the map to drop a pin. Map tiles © OpenStreetMap contributors.
      </p>
    </div>
  );
}
