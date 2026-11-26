import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/floral";
import { FrostStamp } from "@/components/frost-stamp";
import { Button } from "@/components/ui/button";
import { deleteFarm } from "@/lib/actions";
import { loadFarm, loadTasks } from "@/lib/records";
import { startOfWeekMonday, todayISO, addDays } from "@/lib/dates";

export default async function FarmOverview({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const { supabase, farm, crops, beds, site } = await loadFarm(farmId);
  const tasks = site ? await loadTasks(supabase, farmId, farm.season_year) : [];
  const week = startOfWeekMonday(todayISO());
  const weekEnd = addDays(week, 6);
  const due = tasks.filter((task) => !task.completed_at && task.due_date >= week && task.due_date <= weekEnd).slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        bloom="sweetpea"
        kicker="Your farm"
        title={farm.name}
        lede={`The ${farm.season_year} season. Autumn jobs from the year before are already on the list.`}
      />
      <FrostStamp farm={farm} site={site} />
      <Link href={`/flowers/farms/${farm.id}/place`} className="inline-block text-sm underline">
        Adjust place and frost dates
      </Link>
      <Disclaimer compact />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/flowers/farms/${farm.id}/flowers`} className="rounded-xl border border-border bg-card p-4">
          <p className="font-heading text-3xl">{crops.length}</p>
          <p className="text-sm">Flowers on the plan</p>
        </Link>
        <Link href={`/flowers/farms/${farm.id}/map`} className="rounded-xl border border-border bg-secondary/60 p-4">
          <p className="font-heading text-3xl">Map</p>
          <p className="text-sm">Outline the land and measure beds</p>
        </Link>
        <Link href={`/flowers/farms/${farm.id}/beds`} className="rounded-xl border border-border bg-card p-4">
          <p className="font-heading text-3xl">{beds.length}</p>
          <p className="text-sm">Beds drawn</p>
        </Link>
        <Link href={`/flowers/farms/${farm.id}/week`} className="rounded-xl border border-border bg-card p-4">
          <p className="font-heading text-3xl">{due.length}</p>
          <p className="text-sm">Jobs left this week</p>
        </Link>
      </div>
      <section>
        <h2 className="font-heading text-2xl">This week</h2>
        {due.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {crops.length === 0 ? "Add a few flowers and the week will fill itself in." : "Nothing outstanding. The slugs are still working."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {due.map((task) => (
              <li key={task.id} className="text-sm">
                {task.title}
              </li>
            ))}
          </ul>
        )}
        <Button nativeButton={false} render={<Link href={`/flowers/farms/${farm.id}/week`} />} className="mt-3 h-11">
          Open the week
        </Button>
      </section>
      <form action={deleteFarm.bind(null, farm.id)}>
        <button type="submit" className="text-sm text-muted-foreground underline">
          Delete this farm
        </button>
      </form>
    </div>
  );
}
