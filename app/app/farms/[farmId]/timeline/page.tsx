import { YearTimeline } from "@/components/year-timeline";
import { todayISO } from "@/lib/dates";
import { toPlantingDates } from "@/lib/plan-view";
import { loadFarm, loadPlantings } from "@/lib/records";
import { sowNow } from "@/lib/schedule";

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ farmId: string }>;
  searchParams: Promise<{ group?: string; place?: string }>;
}) {
  const { farmId } = await params;
  const query = await searchParams;
  const loaded = await loadFarm(farmId);
  const rows = await loadPlantings(loaded.supabase, farmId);
  const plantings = rows.flatMap((row) => {
    const dates = toPlantingDates(row, loaded.flowers);
    return dates ? [dates] : [];
  });
  const planted = new Set(plantings.map((item) => item.flowerSlug));
  const suggestions = loaded.site ? sowNow(loaded.flowers, loaded.site, todayISO()).filter((item) => !planted.has(item.flower.slug)) : [];
  const blockNames = new Map(loaded.blocks.map((block) => [block.id, block.name]));
  return (
    <YearTimeline
      farmId={farmId}
      plantings={plantings}
      beds={loaded.beds.map((bed) => ({
        id: bed.id,
        name: bed.name,
        blockId: bed.block_id,
        blockName: bed.block_id ? blockNames.get(bed.block_id) ?? null : null,
      }))}
      suggestions={suggestions}
      season={loaded.farm.season_year}
      today={todayISO()}
      lastSpring={
        loaded.farm.last_spring_month && loaded.farm.last_spring_day
          ? `${loaded.farm.season_year}-${String(loaded.farm.last_spring_month).padStart(2, "0")}-${String(loaded.farm.last_spring_day).padStart(2, "0")}`
          : null
      }
      firstAutumn={
        loaded.farm.first_autumn_month && loaded.farm.first_autumn_day
          ? `${loaded.farm.season_year}-${String(loaded.farm.first_autumn_month).padStart(2, "0")}-${String(loaded.farm.first_autumn_day).padStart(2, "0")}`
          : null
      }
      initialGroup={query.group === "bed" ? "bed" : "flower"}
      placeId={query.place ?? null}
    />
  );
}
