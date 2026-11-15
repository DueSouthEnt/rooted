import Link from "next/link";
import { BedBoard } from "@/components/bed-board";
import { loadFarm, loadProfile } from "@/lib/records";

export default async function BedsPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const [{ farm, crops, beds, plants, flowers, site }, profile] = await Promise.all([loadFarm(farmId), loadProfile()]);
  const planned = crops
    .map((crop) => flowers.find((flower) => flower.slug === crop.flower_slug))
    .filter((flower) => flower != null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-4xl">Beds</h1>
        <p className="mt-2 text-muted-foreground">
          Tall plants on the {site?.hemisphere === "south" ? "south" : "north"} side. Perennials in a bed you won't dig up for a row of calendula.
        </p>
      </div>
      {planned.length === 0 ? (
        <p className="text-sm">
          Nothing planted on paper yet.{" "}
          <Link href={`/app/farms/${farm.id}/flowers`} className="underline">
            Choose a few flowers
          </Link>{" "}
          first.
        </p>
      ) : null}
      <BedBoard farm={farm} site={site} beds={beds} plants={plants} flowers={planned} units={profile.units} />
    </div>
  );
}
