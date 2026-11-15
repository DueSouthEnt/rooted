import Link from "next/link";
import { FarmMap } from "@/components/farm-map";
import { loadFarm, loadProfile } from "@/lib/records";

export default async function FarmMapPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const [{ farm, beds, plants, crops, flowers }, profile] = await Promise.all([loadFarm(farmId), loadProfile()]);
  if (farm.latitude == null || farm.longitude == null) {
    return (
      <div className="space-y-3">
        <h1 className="font-heading text-4xl">Farm map</h1>
        <p>The satellite view needs a pin. Set the place first, then come back and draw the land.</p>
        <Link href={`/app/farms/${farm.id}/place`} className="underline">
          Set the place
        </Link>
      </div>
    );
  }
  return (
    <FarmMap
      farm={farm}
      beds={beds}
      plants={plants}
      crops={crops}
      flowers={flowers}
      units={profile.units}
    />
  );
}
