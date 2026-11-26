import { Suspense } from "react";
import { connection } from "next/server";
import { HarvestBoard } from "@/components/veg/harvest/harvest-board";
import { parseISODate, startOfWeekMonday, todayISO } from "@/lib/veg/dates";
import { listPlantings } from "@/lib/veg/queries";
import { getSeason } from "@/lib/veg/season";
import Loading from "../loading";

export const metadata = { title: "Harvest" };

export default function HarvestPage(props: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <HarvestContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function HarvestContent({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const params = await searchParams;
  await connection();
  const season = await getSeason();
  const today = todayISO();
  const requested = typeof params.week === "string" ? params.week : "";
  const week = parseISODate(requested) ? startOfWeekMonday(requested) : startOfWeekMonday(today);
  return <HarvestBoard plantings={await listPlantings(season)} season={season} today={today} initialWeek={week} />;
}
