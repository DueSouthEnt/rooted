import Link from "next/link";
import { FarmMap } from "@/components/farm-map";
import { EmptyFlourish, PageHeader } from "@/components/floral";
import { loadFarm, loadProfile } from "@/lib/records";

export default async function FarmMapPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const [{ farm, beds, blocks, plants, crops, flowers }, profile] = await Promise.all([loadFarm(farmId), loadProfile()]);
  if (farm.latitude == null || farm.longitude == null) {
    return (
      <div className="space-y-3">
        <PageHeader bloom="cosmos" kicker="Overview" title="Farm map" lede="The satellite view needs a pin. Set the place first, then come back and draw the land." />
        <EmptyFlourish title="No pin yet" text="A postcode or a point on the map is enough to centre the picture." />
        <Link href={`/flowers/farms/${farm.id}/place`} className="underline">
          Set the place
        </Link>
      </div>
    );
  }
  return (
    <FarmMap
      farm={farm}
      beds={beds}
      blocks={blocks}
      plants={plants}
      crops={crops}
      flowers={flowers}
      units={profile.units}
    />
  );
}
