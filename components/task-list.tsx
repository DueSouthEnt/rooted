"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { rebuildCalendar, setTaskDone } from "@/lib/actions";
import { addDays, formatDate, startOfWeekMonday, todayISO } from "@/lib/dates";
import type { TaskRecord } from "@/lib/records";

const labels: Record<string, string> = {
  plan: "Plan",
  sow: "Sow",
  harden: "Harden off",
  plant: "Plant",
  pinch: "Pinch",
  support: "Support",
  feed: "Feed",
  harvest: "Cut",
  deadhead: "Deadhead",
  lift: "Lift",
  divide: "Divide",
  mulch: "Mulch",
  note: "Note",
};

export function TaskList({ farmId, tasks }: { farmId: string; tasks: TaskRecord[] }) {
  const router = useRouter();
  const [week, setWeek] = useState(startOfWeekMonday(todayISO()));
  const [mode, setMode] = useState<"week" | "season">("week");
  const [busy, setBusy] = useState<string | null>(null);
  const today = todayISO();
  const weekEnd = addDays(week, 6);
  const visible =
    mode === "week" ? tasks.filter((task) => task.due_date >= week && task.due_date <= weekEnd) : tasks;

  async function toggle(task: TaskRecord) {
    setBusy(task.id);
    await setTaskDone(farmId, task.id, !task.completed_at);
    setBusy(null);
    router.refresh();
  }

  const grouped = new Map<string, TaskRecord[]>();
  for (const task of visible) {
    const list = grouped.get(task.due_date) ?? [];
    list.push(task);
    grouped.set(task.due_date, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={() => setWeek(addDays(week, -7))}>
          Previous
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => setWeek(startOfWeekMonday(today))}>
          This week
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => setWeek(addDays(week, 7))}>
          Next
        </Button>
        <Button type="button" variant={mode === "season" ? "default" : "outline"} className="h-11" onClick={() => setMode(mode === "week" ? "season" : "week")}>
          {mode === "week" ? "Whole season" : "Just the week"}
        </Button>
        <form action={rebuildCalendar.bind(null, farmId)}>
          <Button type="submit" variant="secondary" className="h-11">
            Rebuild list
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        {mode === "week" ? `${formatDate(week)} – ${formatDate(weekEnd)}` : `${tasks.length} jobs in the season`}
      </p>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm">
          Nothing due. Walk the beds anyway — slugs don't use calendars.
        </p>
      ) : (
        <div className="space-y-5">
          {[...grouped.entries()].map(([date, dayTasks]) => (
            <section key={date}>
              <h2 className="text-sm font-medium text-muted-foreground">{formatDate(date)}</h2>
              <ul className="mt-2 space-y-2">
                {dayTasks.map((task) => {
                  const overdue = !task.completed_at && task.due_date < today;
                  return (
                    <li key={task.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                      <button
                        type="button"
                        aria-pressed={Boolean(task.completed_at)}
                        disabled={busy === task.id}
                        onClick={() => void toggle(task)}
                        className={
                          task.completed_at
                            ? "mt-0.5 size-6 shrink-0 rounded border border-primary bg-primary text-primary-foreground"
                            : "mt-0.5 size-6 shrink-0 rounded border border-input"
                        }
                      >
                        {task.completed_at ? "✓" : ""}
                      </button>
                      <div>
                        <p className={task.completed_at ? "text-muted-foreground line-through" : "font-medium"}>
                          {task.title}
                        </p>
                        <p className="text-xs tracking-wide text-muted-foreground uppercase">
                          {labels[task.category] ?? task.category}
                          {overdue ? " · Overdue" : ""}
                        </p>
                        {task.detail ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{task.detail}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
