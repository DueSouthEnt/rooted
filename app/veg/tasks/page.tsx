import { Suspense } from "react";
import { connection } from "next/server";
import { TaskBoard } from "@/components/veg/tasks/task-board";
import { parseISODate, startOfWeekMonday, todayISO } from "@/lib/veg/dates";
import { listBlocks, listPlantings, listTasks } from "@/lib/veg/queries";
import { getSeason } from "@/lib/veg/season";
import Loading from "../loading";

export const metadata = { title: "Tasks" };

export default function TasksPage(props: {
  searchParams: Promise<{ week?: string | string[]; add?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <TasksContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function TasksContent({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[]; add?: string | string[] }>;
}) {
  const params = await searchParams;
  await connection();
  const season = await getSeason();
  const today = todayISO();
  const requested = typeof params.week === "string" ? params.week : "";
  const week = parseISODate(requested) ? startOfWeekMonday(requested) : startOfWeekMonday(today);
  return (
    <TaskBoard
      tasks={await listTasks()}
      plantings={await listPlantings(season)}
      blocks={await listBlocks()}
      season={season}
      today={today}
      initialWeek={week}
      initialAdding={params.add === "1"}
    />
  );
}
