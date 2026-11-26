import { Suspense } from "react";
import { connection } from "next/server";
import { PlanWorkspace } from "@/components/veg/plan/plan-workspace";
import { SharedBedBoard } from "@/components/shared-bed-board";
import { todayISO } from "@/lib/veg/dates";
import { plantingFrostWarnings } from "@/lib/veg/frost";
import { standardBedLengthMetres } from "@/lib/veg/bed-length";
import { getFarmSettings, getFrostContext, listBlocks, listCrops, listPlantings, listTasks } from "@/lib/veg/queries";
import { getSeason } from "@/lib/veg/season";
import { createClient } from "@/lib/supabase/server";
import { loadSharedBoard } from "@/lib/shared-beds";
import { loadProfile } from "@/lib/records";
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
  const profile = await loadProfile();
  const shared = profile.enabledSections.includes("flowers") && profile.enabledSections.includes("veg") ? await sharedForUser() : null;
  return (
    <div className="space-y-8">
      {shared ? <SharedBedBoard farmId={shared.farmId} {...shared.board} /> : null}
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
      standardBedLengthM={standardBedLengthMetres((await getFarmSettings())?.standardBedLengthM)}
    />
    </div>
  );
}

async function sharedForUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: farms } = await supabase.from("farms").select("id").eq("user_id", auth.user.id).order("created_at").limit(1);
  const farmId = farms?.[0]?.id as string | undefined;
  if (!farmId) return null;
  const board = await loadSharedBoard(farmId);
  if (!board) return null;
  return { farmId, board };
}
