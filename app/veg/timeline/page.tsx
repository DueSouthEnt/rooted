import { Suspense } from "react";
import { connection } from "next/server";
import { YearTimeline } from "@/components/veg/plan/year-timeline";
import { todayISO } from "@/lib/veg/dates";
import { standardBedLengthMetres } from "@/lib/veg/bed-length";
import { getFarmSettings, getFrostContext, listAdvicePlantings, listBedRefs, listBlocks, listCompanions, listCrops, listPlantings, listTasks, rotationYearSetting } from "@/lib/veg/queries";
import { getSeason } from "@/lib/veg/season";
import Loading from "../loading";

export const metadata = { title: "Year plan" };

export default function TimelinePage(props: { searchParams: Promise<{ group?: string | string[]; place?: string | string[] }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <TimelineContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function TimelineContent({
  searchParams,
}: {
  searchParams: Promise<{ group?: string | string[]; place?: string | string[] }>;
}) {
  await connection();
  const params = await searchParams;
  const season = await getSeason();
  const group = params.group === "crop" ? "crop" : "bed";
  const place = typeof params.place === "string" ? params.place : null;
  return (
    <YearTimeline
      crops={await listCrops()}
      blocks={await listBlocks()}
      plantings={await listPlantings(season)}
      season={season}
      today={todayISO()}
      frost={await getFrostContext()}
      initialGroup={group}
      placeId={place}
      tasks={await listTasks()}
      rules={await listCompanions()}
      spans={await listAdvicePlantings()}
      bedRefs={await listBedRefs()}
      rotationYears={await rotationYearSetting()}
      standardBedLengthM={standardBedLengthMetres((await getFarmSettings())?.standardBedLengthM)}
    />
  );
}
