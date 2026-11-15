import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { FlowerBoard } from "@/components/flower-board";
import { loadProfile, loadFarm } from "@/lib/records";
import { recommend } from "@/lib/recommend";

export default async function FlowersPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const [{ farm, crops, flowers, site, catalogueSource }, profile] = await Promise.all([
    loadFarm(farmId),
    loadProfile(),
  ]);

  if (!site) {
    return (
      <div className="space-y-3">
        <h1 className="font-heading text-4xl">Flowers</h1>
        <p>Set a place first. Recommendations without a frost date are just a wishlist.</p>
        <Link href={`/app/farms/${farm.id}/place`} className="underline">
          Add the place
        </Link>
      </div>
    );
  }

  const recommendations = recommend(flowers, site);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-4xl">What will grow</h1>
        <p className="mt-2 text-muted-foreground">
          Ranked for {farm.place_name || "this garden"}. Safe bets first. Gambles are still listed, in case you enjoy those.
        </p>
      </div>
      {catalogueSource === "bundled" ? (
        <p className="rounded-xl border border-border bg-card p-3 text-sm">
          Showing the built-in catalogue. Seed the database with <code>npx supabase db reset</code> if you want it in Postgres too.
        </p>
      ) : null}
      <Disclaimer compact />
      <FlowerBoard
        farmId={farm.id}
        recommendations={recommendations}
        crops={crops}
        site={site}
        placeName={farm.place_name}
        units={profile.units}
      />
    </div>
  );
}
