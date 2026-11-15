import { PlaceForm } from "@/components/place-form";
import { createFarm } from "@/lib/actions";

export default function NewFarmPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-4xl">Where do you grow?</h1>
      <p className="text-muted-foreground">
        A postcode is enough. The frost dates that come back are averages — you can change them if your garden has other ideas.
      </p>
      <PlaceForm action={createFarm} submitLabel="Save this farm" initialName="Home patch" />
    </div>
  );
}
