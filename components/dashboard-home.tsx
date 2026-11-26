import Link from "next/link";
import { EmptyFlourish } from "@/components/floral";
import { SowNowCard } from "@/components/sow-now";
import { Button } from "@/components/ui/button";
import type { SowSuggestion } from "@/lib/schedule";
import type { Forecast } from "@/lib/weather";
import type { FarmRecord, TaskRecord } from "@/lib/records";

export function DashboardHome({
  displayName,
  farms,
  farm,
  forecast,
  crops,
  beds,
  plantedBeds,
  tasks,
  today,
  suggestions = [],
}: {
  displayName: string;
  farms: FarmRecord[];
  farm: FarmRecord | null;
  forecast: Forecast | null;
  crops: number;
  beds: number;
  plantedBeds: number;
  tasks: TaskRecord[];
  today: string;
  suggestions?: SowSuggestion[];
}) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLine = new Intl.DateTimeFormat("en-GB", {
    timeZone: forecast?.timezone ?? "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const dueToday = tasks.filter((task) => !task.completed_at && task.due_date <= today);
  const harvests = tasks.filter(
    (task) => task.category === "harvest" && task.due_date >= today && task.due_date <= addDays(today, 14),
  );
  const space = beds === 0 ? 0 : Math.round((plantedBeds / beds) * 100);
  const plantingHref = farm ? `/flowers/farms/${farm.id}/flowers` : "/flowers/farms/new";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{dateLine}</p>
          <h1 className="font-heading mt-1 text-4xl tracking-tight">
            {hello}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here’s what the beds are doing, and what the sky is about to do.</p>
        </div>
        <Button nativeButton={false} render={<Link href={plantingHref} />} className="h-11">
          + New planting
        </Button>
      </div>

      {farms.length > 1 && farm ? (
        <form className="flex items-center gap-2 text-sm" action="/flowers">
          <label htmlFor="farm">Farm</label>
          <select id="farm" name="farm" defaultValue={farm.id} className="h-11 rounded-full border border-input bg-card px-3">
            {farms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-full border border-border px-3">
            Show
          </button>
        </form>
      ) : null}

      <WeatherCard farm={farm} forecast={forecast} />

      {farm && suggestions.length > 0 ? <SowNowCard farmId={farm.id} suggestions={suggestions} /> : null}

      {farm ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Active plantings" value={String(crops)} note="On this farm’s plan" />
            <Stat label="Tasks to finish" value={String(dueToday.length).padStart(2, "0")} note="Due today or overdue" />
            <Stat label="Harvests ahead" value={String(harvests.length)} note="Next 14 days" />
            <Stat label="Bed space in use" value={`${space}%`} note={beds ? `${plantedBeds} of ${beds} beds planted` : "No beds yet"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-2xl">Today’s priorities</h2>
                <Link href={`/flowers/farms/${farm.id}/week`} className="text-sm text-primary underline">
                  View all tasks
                </Link>
              </div>
              {dueToday.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nothing dated for today. Walk the beds anyway — slugs don’t use calendars.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {dueToday.slice(0, 6).map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                      <span>
                        <span className="block text-sm font-medium">{task.title}</span>
                        <span className="text-xs text-muted-foreground">{task.due_date === today ? "Due today" : "Overdue"}</span>
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs capitalize">{task.category}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <SeasonCard farm={farm} />
          </div>
        </>
      ) : (
        <EmptyFlourish
          title="No farm yet"
          text="Add the place you grow — a backyard bed counts — and the weather, frost and jobs will sit up here."
        />
      )}
    </div>
  );
}

function WeatherCard({ farm, forecast }: { farm: FarmRecord | null; forecast: Forecast | null }) {
  if (!farm) return null;
  if (farm.latitude == null || farm.longitude == null) {
    return (
      <section className="rounded-2xl border border-border bg-secondary/50 p-5">
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Weather</p>
        <p className="font-heading mt-1 text-2xl">Set a place to see the sky</p>
        <Link href={`/flowers/farms/${farm.id}/place`} className="mt-2 inline-block text-sm underline">
          Add a postcode or a pin
        </Link>
      </section>
    );
  }
  if (!forecast) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="font-heading text-2xl">Weather didn’t answer</p>
        <p className="mt-1 text-sm text-muted-foreground">Open-Meteo is quiet just now. The frost dates you saved are still on the farm.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
            Weather · {farm.place_name || farm.name}
          </p>
          <p className="font-heading mt-1 text-5xl">{Math.round(forecast.tempC)}°</p>
          <p className="text-sm">{forecast.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Mini label="Today" value={`${Math.round(forecast.todayMaxC)}° / ${Math.round(forecast.todayMinC)}°`} />
          <Mini label="Rain now" value={`${forecast.rainMm.toFixed(1)} mm`} />
          <Mini label="Wind" value={`${Math.round(forecast.windKmh)} km/h`} />
          <Mini label="Source" value="Open-Meteo" />
        </div>
      </div>
      {forecast.frostSoon ? (
        <p className="mt-3 inline-flex rounded-full bg-accent px-3 py-1 text-sm">
          Frost in the forecast — a night at or below 0°C in the next week.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No frost in the next seven nights. Still an estimate, not a promise.</p>
      )}
      <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {forecast.days.map((day) => (
          <li key={day.date} className={`rounded-xl px-2 py-2 text-center text-xs ${day.frost ? "bg-accent" : "bg-background"}`}>
            <p className="text-muted-foreground">
              {new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`))}
            </p>
            <p className="mt-1 font-medium">
              {Math.round(day.tempMaxC)}° <span className="text-muted-foreground">{Math.round(day.tempMinC)}°</span>
            </p>
            <p className="mt-1 truncate">{day.label}</p>
            <p className="text-muted-foreground">{day.rainMm.toFixed(1)} mm</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-4xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function SeasonCard({ farm }: { farm: FarmRecord }) {
  const year = farm.season_year;
  const last = farm.last_spring_month && farm.last_spring_day ? `${farm.last_spring_day} ${monthName(farm.last_spring_month)}` : "not set";
  const first = farm.first_autumn_month && farm.first_autumn_day ? `${farm.first_autumn_day} ${monthName(farm.first_autumn_month)}` : "not set";
  const progress = seasonProgress(farm);
  return (
    <section className="rounded-2xl border border-border bg-secondary/40 p-4">
      <h2 className="font-heading text-2xl">Season {year}</h2>
      {progress != null ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{progress}% of the frost-free stretch</p>
        </div>
      ) : null}
      <p className="mt-2 text-sm">Last spring frost {last}</p>
      <p className="text-sm">First autumn frost {first}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {farm.rhs_rating ? `RHS ${farm.rhs_rating}` : "RHS not set"}
        {farm.usda_zone ? ` · USDA ${farm.usda_zone}` : ""}
        {farm.season_length_days ? ` · ${farm.season_length_days} days` : ""}
      </p>
      <Link href={`/flowers/farms/${farm.id}/map`} className="mt-3 inline-block text-sm underline">
        Open the farm map
      </Link>
    </section>
  );
}

function seasonProgress(farm: FarmRecord): number | null {
  if (!farm.last_spring_month || !farm.last_spring_day || !farm.first_autumn_month || !farm.first_autumn_day) return null;
  const start = Date.UTC(farm.season_year, farm.last_spring_month - 1, farm.last_spring_day);
  let endYear = farm.season_year;
  if (farm.first_autumn_month < farm.last_spring_month) endYear += 1;
  const end = Date.UTC(endYear, farm.first_autumn_month - 1, farm.first_autumn_day);
  if (end <= start) return null;
  const now = Date.now();
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

function monthName(month: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
