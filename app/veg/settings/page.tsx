import { Suspense } from "react";
import { connection } from "next/server";
import { FrostSettings } from "@/components/veg/settings/frost-settings";
import { standardBedLengthMetres } from "@/lib/veg/bed-length";
import { readDisplayUnit } from "@/lib/veg/display-unit";
import { getFarmSettings, listFrostLocations, rotationYearSetting } from "@/lib/veg/queries";
import { FROST_LOCATIONS, type FrostLocation } from "@/lib/veg/seed/frost-locations";
import Loading from "../loading";

export const metadata = { title: "Frost dates" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await connection();
  const saved = await getFarmSettings();
  const fromDb = await listFrostLocations();
  const locations: FrostLocation[] = fromDb.length
    ? fromDb.map((place) => ({
        id: place.id,
        name: place.name,
        country: "GB",
        region: place.region,
        latitude: place.latitude,
        longitude: place.longitude,
        lastSpringFrost: place.lastSpringFrost,
        firstAutumnFrost: place.firstAutumnFrost,
        sourceName: place.sourceName,
        sourceUrl: place.sourceUrl,
      }))
    : FROST_LOCATIONS;
  return (
    <FrostSettings
      locations={locations}
      currentLabel={saved?.locationLabel ?? ""}
      currentLocationId={saved?.frostLocationId ?? null}
      manualLast={saved?.manualLastSpringFrost ?? null}
      manualFirst={saved?.manualFirstAutumnFrost ?? null}
      useManual={saved?.useManualFrost === 1}
      rotationYears={await rotationYearSetting()}
      standardBedLengthM={standardBedLengthMetres(saved?.standardBedLengthM)}
      displayUnit={await readDisplayUnit()}
    />
  );
}
