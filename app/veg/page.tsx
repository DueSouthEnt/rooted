import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { BotanicalBanner, WeekGreeting } from "@/components/veg/overview/botanical-banner";
import { WeatherStrip, type ForecastDay } from "@/components/veg/overview/weather-strip";
import { WeekTicks } from "@/components/veg/overview/week-ticks";
import { ukCropName } from "@/lib/veg/crop-names";
import { addDaysISO, formatMedium, startOfWeekMonday, todayISO } from "@/lib/veg/dates";
import { plantingFrostWarnings } from "@/lib/veg/frost";
import { plantingPhase } from "@/lib/veg/planning";
import { getFarmSettings, getFrostContext, listBlocks, listPlantings, listTasks } from "@/lib/veg/queries";
import { getSeason } from "@/lib/veg/season";
import Loading from "./loading";

export const metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OverviewContent />
    </Suspense>
  );
}

function nextFrost(today: string, lastSpring: string, firstAutumn: string) {
  const year = Number(today.slice(0, 4));
  const dates = [
    { date: `${year}-${firstAutumn}`, label: "Average first autumn frost" },
    { date: `${year + 1}-${lastSpring}`, label: "Average last spring frost" },
    { date: `${year}-${lastSpring}`, label: "Average last spring frost" },
  ].filter((item) => item.date >= today);
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return dates[0] ?? null;
}

async function loadForecast(latitude: number, longitude: number): Promise<ForecastDay[] | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Europe/London&forecast_days=7`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_min?: number[];
        temperature_2m_max?: number[];
        weather_code?: number[];
      };
    };
    const days = body.daily?.time ?? [];
    return days.map((date, index) => ({
      date,
      min: body.daily?.temperature_2m_min?.[index] ?? null,
      max: body.daily?.temperature_2m_max?.[index] ?? null,
      code: body.daily?.weather_code?.[index] ?? null,
    }));
  } catch {
    return null;
  }
}

async function OverviewContent() {
  await connection();
  const season = await getSeason();
  const today = todayISO();
  const settings = await getFarmSettings();
  const frost = await getFrostContext();
  const blocks = await listBlocks();
  const plantings = await listPlantings(season);
  const tasks = (await listTasks()).filter((task) => task.seasonYear === season || task.seasonYear === null);
  const weekEnd = addDaysISO(startOfWeekMonday(today), 6);
  const open = tasks.filter((task) => task.status === "open");
  const overdue = open.filter((task) => task.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const stillToDo = open.filter((task) => task.dueDate >= today && task.dueDate <= weekEnd);
  const harvesting = plantings.filter((planting) => plantingPhase(planting, today) === "harvesting");
  const soon = plantings.filter(
    (planting) => planting.firstHarvestDate > today && planting.firstHarvestDate <= addDaysISO(today, 14),
  );
  const frostSoon = frost
    ? plantings.filter((planting) => {
        const fieldSoon = planting.fieldPlantingDate >= today && planting.fieldPlantingDate <= addDaysISO(today, 14);
        return (
          fieldSoon &&
          plantingFrostWarnings({
            tolerance: planting.frostTolerance,
            fieldPlantingDate: planting.fieldPlantingDate,
            lastHarvestDate: planting.lastHarvestDate,
            lastSpringFrost: frost.lastSpringFrost,
            firstAutumnFrost: frost.firstAutumnFrost,
          }).warnings.length > 0
        );
      })
    : [];
  const upcomingFrost = frost ? nextFrost(today, frost.lastSpringFrost, frost.firstAutumnFrost) : null;
  const occupied = new Set(
    plantings
      .filter((planting) => planting.fieldPlantingDate <= today && planting.lastHarvestDate >= today)
      .flatMap((planting) => planting.beds.map((bed) => bed.id)),
  );
  const bedCount = blocks.reduce((sum, block) => sum + block.beds.length, 0);
  const unassigned = plantings.filter((planting) => planting.beds.length === 0);
  const farm = settings?.locationLabel || "your farm";
  const forecast =
    settings?.latitude != null && settings.longitude != null ? await loadForecast(settings.latitude, settings.longitude) : null;
  const harvestNames = [...new Set(harvesting.map((planting) => ukCropName(planting.cropName)))];
  const soonNames = [...new Set(soon.map((planting) => ukCropName(planting.cropName)))];

  return (
    <div className="grid gap-5" data-testid="overview">
      <section className="overflow-hidden rounded-2xl border bg-card text-foreground" data-testid="banner">
        <div className="grid lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-center">
          <div className="order-2 flex flex-col justify-center px-5 py-5 lg:order-1 lg:px-7 lg:py-6">
            <WeekGreeting farm={farm} />
            <p className="mt-2 text-sm text-muted-foreground">Season {season}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/veg/plan" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                Add planting
              </Link>
              <Link href="/tasks?add=1" className="rounded-lg border bg-card px-3 py-2 text-sm">
                Add task
              </Link>
            </div>
          </div>
          <BotanicalBanner className="order-1 w-full lg:order-2" />
        </div>
      </section>

      <WeatherStrip days={forecast} />

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl">This week</h2>
          <Link href="/veg/tasks" className="text-sm text-primary underline-offset-2 hover:underline">
            All tasks
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {stillToDo.length === 0
            ? "Nothing else is due before the week ends."
            : `${stillToDo.length} ${stillToDo.length === 1 ? "job is" : "jobs are"} still ahead.`}{" "}
          {harvestNames.length === 0
            ? "Nothing is ready to pick today."
            : `${harvestNames.length} ${harvestNames.length === 1 ? "crop is" : "crops are"} ready to pick.`}{" "}
          {occupied.size} of {bedCount} beds are in use.
        </p>
        {stillToDo.length > 0 ? (
          <WeekTicks
            tasks={stillToDo.slice(0, 6).map((task) => ({ id: task.id, title: task.title, dueDate: task.dueDate, done: false }))}
          />
        ) : null}
      </section>

      {overdue.length > 0 ? (
        <details className="rounded-2xl border bg-card px-5 py-3" data-testid="catch-up">
          <summary className="cursor-pointer text-sm font-medium">Catch-up list ({overdue.length})</summary>
          <div className="pb-2">
            <WeekTicks
              tasks={overdue.slice(0, 8).map((task) => ({ id: task.id, title: task.title, dueDate: task.dueDate, done: false }))}
            />
            {overdue.length > 8 ? (
              <Link href="/veg/tasks" className="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline">
                See the rest on Tasks
              </Link>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-2xl">Harvest</h2>
            <p className="mt-2 text-sm">Ready now: {harvestNames.join(", ") || "nothing"}.</p>
            <p className="mt-1 text-sm text-muted-foreground">Coming up in 14 days: {soonNames.join(", ") || "nothing new"}.</p>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-2xl">Frost</h2>
            {upcomingFrost ? (
              <p className="mt-2 text-sm">
                {upcomingFrost.label}: {formatMedium(upcomingFrost.date)}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Set a frost station to see the next average frost.</p>
            )}
            {frostSoon.length > 0 ? (
              <ul className="mt-2 text-sm">
                {frostSoon.map((planting) => (
                  <li key={planting.id}>
                    {ukCropName(planting.cropName)} · {planting.cultivar} goes out on {formatMedium(planting.fieldPlantingDate)}.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No plantings in the next fortnight carry a frost warning.</p>
            )}
          </section>
        </div>
        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-xl">Beds today</h2>
            <p className="mt-2 text-sm">
              {occupied.size} in use, {bedCount - occupied.size} empty.
            </p>
            {plantings.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground" data-testid="overview-empty">
                No plantings for {season} yet. Add the first one on the year plan.
              </p>
            ) : unassigned.length > 0 ? (
              <Link href="/timeline?group=bed" className="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline">
                {unassigned.length} planting{unassigned.length === 1 ? "" : "s"} still need a bed
              </Link>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Every planting has a bed.</p>
            )}
          </section>
          <Link href="/veg/farm" className="rounded-2xl border bg-card p-5" data-testid="farm-thumb">
            <h2 className="font-display text-xl">Today on the farm</h2>
            <div className="mt-3 grid gap-2">
              {blocks.map((block) => (
                <div key={block.id}>
                  <p className="text-xs text-muted-foreground">{block.name}</p>
                  <div className="mt-1 flex gap-1">
                    {block.beds.map((bed) => {
                      const planting = plantings.find(
                        (item) =>
                          item.beds.some((assigned) => assigned.id === bed.id) &&
                          item.fieldPlantingDate <= today &&
                          item.lastHarvestDate >= today,
                      );
                      return (
                        <span
                          key={bed.id}
                          title={planting ? ukCropName(planting.cropName) : "Empty"}
                          className="h-8 flex-1 rounded-sm"
                          style={{ background: planting?.color ?? "var(--bed-path)" }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Link>
        </aside>
      </div>
    </div>
  );
}
