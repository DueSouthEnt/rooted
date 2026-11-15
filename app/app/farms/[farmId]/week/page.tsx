import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { EmptyFlourish, PageHeader } from "@/components/floral";
import { TaskList } from "@/components/task-list";
import { rebuildCalendar, updateSeasonYear } from "@/lib/actions";
import { loadFarm, loadTasks } from "@/lib/records";

export default async function WeekPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const loaded = await loadFarm(farmId);
  let tasks = loaded.site ? await loadTasks(loaded.supabase, farmId, loaded.farm.season_year) : [];
  if (tasks.length === 0 && loaded.crops.length > 0 && loaded.site) {
    await rebuildCalendar(farmId);
    tasks = await loadTasks(loaded.supabase, farmId, loaded.farm.season_year);
  }

  if (!loaded.site) {
    return (
      <div className="space-y-4">
        <PageHeader bloom="dahlia" kicker="Overview" title="This week" lede="The calendar needs frost dates before it will date a single job." />
        <EmptyFlourish title="No frost dates yet" text="Set the place, then the Monday list can start." />
        <Link href={`/app/farms/${farmId}/place`} className="underline">
          Set the place
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          bloom="dahlia"
          kicker="Overview"
          title={`The ${loaded.farm.season_year} season`}
          lede="Jobs are dated from your frost dates. Ticks stay put if the same job comes back."
        />
        <form action={updateSeasonYear.bind(null, farmId)} className="flex items-end gap-2">
          <label className="text-sm">
            Season
            <input
              name="seasonYear"
              type="number"
              defaultValue={loaded.farm.season_year}
              className="mt-1 h-11 w-28 rounded-lg border border-input bg-card px-3"
            />
          </label>
          <button type="submit" className="h-11 rounded-lg border border-border px-3 text-sm">
            Switch
          </button>
        </form>
      </div>
      {loaded.crops.length === 0 ? (
        <p className="text-sm">
          Add flowers and we'll write the list.{" "}
          <Link className="underline" href={`/app/farms/${farmId}/flowers`}>
            Choose some
          </Link>
          .
        </p>
      ) : (
        <TaskList farmId={farmId} tasks={tasks} />
      )}
      <Disclaimer compact />
    </div>
  );
}
