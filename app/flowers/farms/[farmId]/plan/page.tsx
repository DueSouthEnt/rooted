import { GamePlan } from "@/components/game-plan";
import { todayISO } from "@/lib/dates";
import { toPlantingDates } from "@/lib/plan-view";
import { loadFarm, loadPlantings } from "@/lib/records";
import { sowNow } from "@/lib/schedule";

export default async function PlanPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const loaded = await loadFarm(farmId);
  const rows = await loadPlantings(loaded.supabase, farmId);
  const plantings = rows.flatMap((row) => {
    const dates = toPlantingDates(row, loaded.flowers);
    return dates ? [dates] : [];
  });
  const planted = new Set(plantings.map((item) => item.flowerSlug));
  const suggestions = loaded.site ? sowNow(loaded.flowers, loaded.site, todayISO()).filter((item) => !planted.has(item.flower.slug)) : [];
  const bedNames = Object.fromEntries(loaded.beds.map((bed) => [bed.id, bed.name]));
  return <GamePlan farmId={farmId} plantings={plantings} suggestions={suggestions} season={loaded.farm.season_year} bedNames={bedNames} />;
}
