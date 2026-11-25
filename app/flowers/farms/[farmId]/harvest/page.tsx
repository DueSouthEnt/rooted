import { HarvestBoard } from "@/components/harvest-board";
import { todayISO } from "@/lib/dates";
import { toPlantingDates } from "@/lib/plan-view";
import { loadFarm, loadPlantings } from "@/lib/records";

export default async function HarvestPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const loaded = await loadFarm(farmId);
  const rows = await loadPlantings(loaded.supabase, farmId);
  const plantings = rows.flatMap((row) => {
    const dates = toPlantingDates(row, loaded.flowers);
    return dates ? [dates] : [];
  });
  const bedNames = Object.fromEntries(loaded.beds.map((bed) => [bed.id, bed.name]));
  return <HarvestBoard plantings={plantings} season={loaded.farm.season_year} today={todayISO()} bedNames={bedNames} />;
}
