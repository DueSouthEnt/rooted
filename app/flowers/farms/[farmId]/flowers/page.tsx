import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { EmptyFlourish, PageHeader } from "@/components/floral";
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
        <PageHeader bloom="poppy" kicker="Growing" title="Crop library" lede="Set a place first. Recommendations without a frost date are just a wishlist." />
        <EmptyFlourish title="No place on this farm" text="A postcode is enough to rank what is worth sowing." />
        <Link href={`/flowers/farms/${farm.id}/place`} className="underline">
          Add the place
        </Link>
      </div>
    );
  }

  const recommendations = recommend(flowers, site);
  return (
    <div className="space-y-4">
      <PageHeader
        bloom="poppy"
        kicker="Growing"
        title="What will grow"
        lede={`Ranked for ${farm.place_name || "this garden"}. Safe bets first. Gambles are still listed, in case you enjoy those.`}
      />
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
