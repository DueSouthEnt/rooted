import { Suspense } from "react";
import { connection } from "next/server";
import { PlanWorkspace } from "@/components/veg/plan/plan-workspace";
import { todayISO } from "@/lib/veg/dates";
import { plantingFrostWarnings } from "@/lib/veg/frost";
import { getFrostContext, listBlocks, listCrops, listPlantings, listTasks } from "@/lib/veg/queries";
import { getSeason } from "@/lib/veg/season";
import Loading from "../loading";

export const metadata = { title: "Game plan" };

export default function PlanPage(props: {
  searchParams: Promise<{ planting?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <PlanContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PlanContent({
  searchParams,
}: {
  searchParams: Promise<{ planting?: string | string[] }>;
}) {
  const params = await searchParams;
  await connection();
  const season = await getSeason();
  const edit = typeof params.planting === "string" ? params.planting : null;
  const frost = await getFrostContext();
  const plantings = await listPlantings(season);
  const frostRiskIds = frost
    ? plantings
        .filter(
          (planting) =>
            plantingFrostWarnings({
              tolerance: planting.frostTolerance,
              fieldPlantingDate: planting.fieldPlantingDate,
              lastHarvestDate: planting.lastHarvestDate,
              lastSpringFrost: frost.lastSpringFrost,
              firstAutumnFrost: frost.firstAutumnFrost,
            }).warnings.length > 0,
        )
        .map((planting) => planting.id)
    : [];
  return (
    <PlanWorkspace
      crops={await listCrops()}
      blocks={await listBlocks()}
      plantings={plantings}
      season={season}
      today={todayISO()}
      initialEditId={edit}
      frost={frost}
      frostRiskIds={frostRiskIds}
      tasks={await listTasks()}
    />
  );
}
