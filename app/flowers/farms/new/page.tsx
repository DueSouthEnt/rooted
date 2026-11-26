import { PageHeader } from "@/components/floral";
import { PlaceForm } from "@/components/place-form";
import { createFarm } from "@/lib/actions";

export default function NewFarmPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        bloom="sweetpea"
        kicker="Your farm"
        title="Where do you grow?"
        lede="A postcode is enough. The frost dates that come back are averages — you can change them if your garden has other ideas."
      />
      <PlaceForm action={createFarm} submitLabel="Save this farm" initialName="Home patch" />
    </div>
  );
}
