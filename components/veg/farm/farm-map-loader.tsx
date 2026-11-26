"use client";

import dynamic from "next/dynamic";
import type { MapTiles } from "@/lib/veg/map-tiles";
import type { FrostContext } from "@/lib/veg/queries";
import type { BlockView, CropView, FarmAreaView, PlantingView, TaskView } from "@/lib/veg/views";
import Loading from "@/app/veg/loading";

const SatelliteFarm = dynamic(() => import("@/components/veg/farm/satellite-farm").then((mod) => mod.SatelliteFarm), {
  ssr: false,
  loading: () => <Loading />,
});

type FarmPoint = {
  locationLabel: string;
  frostLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
  manualLastSpringFrost: string | null;
  manualFirstAutumnFrost: string | null;
  useManualFrost: boolean;
};

export function FarmMapLoader(props: {
  tiles: MapTiles;
  areas: FarmAreaView[];
  blocks: BlockView[];
  settings: FarmPoint;
  plantings: PlantingView[];
  crops: CropView[];
  frost: FrostContext | null;
  season: number;
  today: string;
  tasks?: TaskView[];
}) {
  return <SatelliteFarm {...props} />;
}
