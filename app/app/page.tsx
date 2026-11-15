import Link from "next/link";
import { listFarms } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const { farms, displayName, error } = await listFarms();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Right then, {displayName}.</h1>
        <p className="mt-2 text-muted-foreground">Each farm keeps its own frost dates, beds, and list of jobs.</p>
      </div>
      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-card p-4 text-sm">
          Can't reach the database. If you're running this locally, start Supabase with <code>npx supabase start</code> and check <code>.env.local</code>.
        </p>
      ) : null}
      {farms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6">
          <p>No farm yet. Add the place you grow — a backyard bed counts.</p>
          <Button nativeButton={false} render={<Link href="/app/farms/new" />} className="mt-4 h-11">
            Add a farm
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {farms.map((farm) => (
            <li key={farm.id} className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-heading text-2xl">{farm.name}</h2>
              <p className="text-sm text-muted-foreground">
                {farm.place_name || "Place not set"} · {farm.season_year} season
                {farm.rhs_rating ? ` · RHS ${farm.rhs_rating}` : ""}
                {farm.usda_zone ? ` · USDA ${farm.usda_zone}` : ""}
              </p>
              <Button nativeButton={false} render={<Link href={`/app/farms/${farm.id}`} />} className="mt-3 h-11">
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
      {farms.length > 0 ? (
        <Button nativeButton={false} render={<Link href="/app/farms/new" />} variant="outline" className="h-11">
          Add another farm
        </Button>
      ) : null}
    </div>
  );
}
