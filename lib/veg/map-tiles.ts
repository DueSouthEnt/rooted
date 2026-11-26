export type MapTiles = {
  url: string;
  attribution: string;
  maxZoom: number;
  provider: "esri" | "mapbox" | "custom";
};

const ESRI_ATTRIBUTION =
  'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community';

/** Satellite tiles. Esri World Imagery needs no key. MAPBOX_TOKEN or MAP_TILE_URL overrides it. */
export function resolveMapTiles(): MapTiles {
  const custom = process.env.MAP_TILE_URL?.trim();
  if (custom) {
    const maxZoom = Number(process.env.MAP_TILE_MAX_ZOOM);
    return {
      url: custom,
      attribution: process.env.MAP_TILE_ATTRIBUTION?.trim() || "Custom map tiles",
      maxZoom: Number.isFinite(maxZoom) && maxZoom > 0 ? maxZoom : 22,
      provider: "custom",
    };
  }
  const mapbox = process.env.MAPBOX_TOKEN?.trim();
  if (mapbox) {
    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=${encodeURIComponent(mapbox)}`,
      attribution:
        '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 22,
      provider: "mapbox",
    };
  }
  return {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: ESRI_ATTRIBUTION,
    maxZoom: 19,
    provider: "esri",
  };
}
