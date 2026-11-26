import { PageHeader } from "@/components/floral";
import { PlaceForm } from "@/components/place-form";
import { updateFarmClimate } from "@/lib/actions";
import { monthDayToIso } from "@/lib/dates";
import { loadFarm } from "@/lib/records";

export default async function PlacePage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const { farm } = await loadFarm(farmId);
  const lastSpring =
    farm.last_spring_month && farm.last_spring_day
      ? monthDayToIso(farm.season_year, farm.last_spring_month, farm.last_spring_day)
      : "";
  const autumnYear = farm.hemisphere === "south" && (farm.first_autumn_month ?? 12) <= 6 ? farm.season_year + 1 : farm.season_year;
  const firstAutumn =
    farm.first_autumn_month && farm.first_autumn_day
      ? monthDayToIso(autumnYear, farm.first_autumn_month, farm.first_autumn_day)
      : "";

  return (
    <div className="space-y-4">
      <PageHeader
        bloom="leaf"
        kicker="Your farm"
        title="Place and frost"
        lede="Change the pin, or override the dates if you know this garden better than the average."
      />
      <PlaceForm
        action={updateFarmClimate.bind(null, farm.id)}
        submitLabel="Update frost dates"
        initialName={farm.name}
        initial={{
          placeName: farm.place_name ?? "",
          country: farm.country ?? "",
          postalCode: farm.postal_code ?? "",
          latitude: farm.latitude,
          longitude: farm.longitude,
          hemisphere: farm.hemisphere ?? "north",
          frostFree: farm.frost_free,
          occasionalFrost: farm.occasional_frost,
          lastSpring,
          firstAutumn,
          seasonLengthDays: farm.season_length_days ?? 0,
          usdaZone: farm.usda_zone ?? "",
          rhs: farm.rhs_rating ?? "",
          summer: farm.summer ?? "mild",
          winterMinC: farm.winter_min_c == null ? "" : String(farm.winter_min_c),
          tropical: farm.tropical,
          seasonYear: farm.season_year,
          source: farm.frost_source ?? "manual",
          note: farm.frost_note ?? "",
        }}
      />
    </div>
  );
}
