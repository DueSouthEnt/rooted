import { DashboardHome } from "@/components/dashboard-home";
import { listFarms } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { loadFarm, loadPlantings, loadTasks } from "@/lib/records";
import { sowNow } from "@/lib/schedule";
import { fetchForecast } from "@/lib/weather";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ farm?: string }> }) {
  const { farm: requested } = await searchParams;
  const { farms, displayName, error } = await listFarms();
  const farm = farms.find((item) => item.id === requested) ?? farms[0] ?? null;

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/40 bg-card p-4 text-sm">
        Can&apos;t reach the database. If you&apos;re running this locally, start Supabase with <code>npx supabase start</code> and check <code>.env.local</code>.
      </p>
    );
  }

  if (!farm) {
    return (
      <DashboardHome
        displayName={displayName}
        farms={[]}
        farm={null}
        forecast={null}
        crops={0}
        beds={0}
        plantedBeds={0}
        tasks={[]}
        today={todayISO()}
      />
    );
  }

  const loaded = await loadFarm(farm.id);
  const tasks = await loadTasks(loaded.supabase, farm.id, farm.season_year);
  const forecast =
    farm.latitude != null && farm.longitude != null ? await fetchForecast(farm.latitude, farm.longitude) : null;
  const planted = new Set(loaded.plants.map((plant) => plant.bed_id));
  const plantingRows = await loadPlantings(loaded.supabase, farm.id);
  const already = new Set(plantingRows.map((row) => row.flower_slug));
  const suggestions = loaded.site ? sowNow(loaded.flowers, loaded.site, todayISO()).filter((item) => !already.has(item.flower.slug)) : [];

  return (
    <DashboardHome
      displayName={displayName}
      farms={farms}
      farm={farm}
      forecast={forecast}
      crops={loaded.crops.length}
      beds={loaded.beds.length}
      plantedBeds={loaded.beds.filter((bed) => planted.has(bed.id)).length}
      tasks={tasks}
      today={todayISO()}
      suggestions={suggestions}
    />
  );
}
