import { PlantsBoard } from "@/components/plants-board";
import { toPlantingDates } from "@/lib/plan-view";
import { readStandardBedLength } from "@/lib/veg/standard-length";
import { loadFarm, loadPlantings } from "@/lib/records";

export default async function PlantsPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const loaded = await loadFarm(farmId);
  const rows = await loadPlantings(loaded.supabase, farmId);
  const plantings = rows.flatMap((row) => {
    const dates = toPlantingDates(row, loaded.flowers);
    return dates ? [dates] : [];
  });
  return (
    <PlantsBoard
      farmId={farmId}
      plantings={plantings}
      flowers={loaded.flowers}
      site={loaded.site}
      season={loaded.farm.season_year}
      bedNames={Object.fromEntries(loaded.beds.map((bed) => [bed.id, bed.name]))}
      defaultBedLengthM={await readStandardBedLength(farmId)}
    />
  );
}
