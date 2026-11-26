import { Suspense } from "react";
import { connection } from "next/server";
import { FarmMapLoader } from "@/components/veg/farm/farm-map-loader";
import { todayISO } from "@/lib/veg/dates";
import { resolveMapTiles } from "@/lib/veg/map-tiles";
import { getFarmSettings, getFrostContext, listBlocks, listCrops, listFarmAreas, listPlantings, listTasks } from "@/lib/veg/queries";
import { getSeason } from "@/lib/veg/season";
import Loading from "../loading";

export const metadata = { title: "Farm map" };

export default function FarmPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FarmContent />
    </Suspense>
  );
}

async function FarmContent() {
  await connection();
  const settings = await getFarmSettings();
  const season = await getSeason();
  return (
    <FarmMapLoader
      tiles={resolveMapTiles()}
      areas={await listFarmAreas()}
      blocks={await listBlocks()}
      plantings={await listPlantings(season)}
      crops={await listCrops()}
      frost={await getFrostContext()}
      season={season}
      today={todayISO()}
      tasks={await listTasks()}
      settings={{
        locationLabel: settings?.locationLabel ?? "",
        frostLocationId: settings?.frostLocationId ?? null,
        latitude: settings?.latitude ?? null,
        longitude: settings?.longitude ?? null,
        manualLastSpringFrost: settings?.manualLastSpringFrost ?? null,
        manualFirstAutumnFrost: settings?.manualFirstAutumnFrost ?? null,
        useManualFrost: settings?.useManualFrost === 1,
      }}
    />
  );
}
