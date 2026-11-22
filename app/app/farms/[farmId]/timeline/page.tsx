import { YearTimeline } from "@/components/year-timeline";
import { diffDays, todayISO } from "@/lib/dates";
import { toPlantingDates } from "@/lib/plan-view";
import { recommend } from "@/lib/recommend";
import { loadFarm, loadPlantings } from "@/lib/records";
import { scheduleFlower, sowNow } from "@/lib/schedule";

export default async function TimelinePage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const loaded = await loadFarm(farmId);
  const rows = await loadPlantings(loaded.supabase, farmId);
  const plantings = rows.flatMap((row) => {
    const dates = toPlantingDates(row, loaded.flowers);
    return dates ? [dates] : [];
  });
  const suggestions = loaded.site ? sowNow(loaded.flowers, loaded.site, todayISO()) : [];
  const quickCrops = loaded.site
    ? recommend(loaded.flowers, loaded.site)
        .filter((item) => item.fit !== "risky" && (item.flower.lifeCycle === "annual" || item.flower.lifeCycle === "biennial"))
        .slice(0, 12)
        .map((item) => {
          const window = scheduleFlower(item.flower, loaded.site!);
          return { name: item.flower.commonName, slug: item.flower.slug, days: diffDays(window.fieldDate, window.bloomEnd) + 1, window };
        })
    : [];
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
        blockIndex: bed.block_index,
      }))}
      suggestions={suggestions}
      quickCrops={quickCrops}
      flowers={loaded.flowers}
      site={loaded.site}
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
    />
  );
}
