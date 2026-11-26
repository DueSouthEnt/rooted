"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTaskAction, deleteTaskAction, rescheduleTaskAction, setTaskStatusAction, updateTaskAction } from "@/app/veg/actions";
import { controlClass, Field } from "@/components/veg/field";
import { PageHeader } from "@/components/veg/page-header";
import { Button } from "@/components/veg/ui/button";
import { Checkbox } from "@/components/veg/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/veg/ui/dialog";
import { Input } from "@/components/veg/ui/input";
import { Textarea } from "@/components/veg/ui/textarea";
import { ukCropName } from "@/lib/veg/crop-names";
import { addDaysISO, formatMedium, formatWeekday, formatWeekRange, startOfWeekMonday } from "@/lib/veg/dates";
import { TASK_TYPE_CHOICES, taskTypeLabel } from "@/lib/veg/labels";
import { minutesForTaskType } from "@/lib/veg/planning";
import { repeatIntervalDays } from "@/lib/veg/repeat";
import { RepeatFields, TaskTypeSelect, emptyRepeat } from "@/components/veg/tasks/task-fields";
import type { TaskStatus, TaskType } from "@/lib/veg/types";
import type { BlockView, PlantingView, TaskView } from "@/lib/veg/views";

type View = "week" | "board" | "list" | "hours";

function minutesOf(task: TaskView): number {
  return task.minutes ?? minutesForTaskType(task.taskType);
}

export function TaskBoard({
  tasks,
  plantings,
  blocks,
  season,
  today,
  initialWeek,
  initialAdding = false,
}: {
  tasks: TaskView[];
  plantings: PlantingView[];
  blocks: BlockView[];
  season: number;
  today: string;
  initialWeek: string;
  initialAdding?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [week, setWeek] = useState(initialWeek);
  const [view, setView] = useState<View>("week");
  const [status, setStatus] = useState<TaskStatus | "all">("open");
  const [type, setType] = useState<TaskType | "all">("all");
  const [blockId, setBlockId] = useState("all");
  const [crop, setCrop] = useState("all");
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});
  const [adding, setAdding] = useState(initialAdding);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    taskType: "other" as TaskType,
    dueDate: today,
    notes: "",
    plantingId: "",
    minutes: 30,
    repeat: emptyRepeat(today),
  });
  const [customTypes, setCustomTypes] = useState<{ id: string; name: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const dragId = useRef<string | null>(null);
  const ghost = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => tasks.filter((task) => task.seasonYear === season || task.seasonYear === null),
    [season, tasks],
  );
  function statusOf(task: TaskView): TaskStatus {
    return overrides[task.id] ?? task.status;
  }
  const days = Array.from({ length: 7 }, (_, index) => addDaysISO(week, index));
  const crops = ["all", ...Array.from(new Set(visible.map((task) => (task.cropName ? ukCropName(task.cropName) : "")).filter(Boolean))).sort()];

  function matches(task: TaskView) {
    const current = statusOf(task);
    if (status !== "all" && current !== status) return false;
    if (type !== "all" && task.taskType !== type) return false;
    if (crop !== "all" && ukCropName(task.cropName ?? "") !== crop) return false;
    if (blockId !== "all") {
      const block = blocks.find((item) => item.id === blockId);
      if (block && !(task.bedLabels ?? "").includes(block.name)) return false;
    }
    return true;
  }

  function chooseWeek(next: string) {
    setWeek(next);
    router.replace(`${pathname}?week=${next}`, { scroll: false });
  }

  function openEdit(task: TaskView) {
    setEditingId(task.id);
    setDraft({
      title: task.title,
      taskType: task.taskType,
      dueDate: task.dueDate,
      notes: task.notes,
      plantingId: task.plantingId ?? "",
      minutes: minutesOf(task),
      repeat: task.repeatEveryDays
        ? {
            repeat: true,
            every: task.repeatEveryDays % 7 === 0 ? task.repeatEveryDays / 7 : task.repeatEveryDays,
            unit: task.repeatEveryDays % 7 === 0 ? "weeks" : "days",
            until: task.repeatUntil ?? "",
          }
        : emptyRepeat(task.dueDate),
    });
    setAdding(true);
  }

  function tick(task: TaskView, done: boolean) {
    const next = done ? "done" : "open";
    setOverrides((current) => ({ ...current, [task.id]: next }));
    startTransition(async () => {
      const result = await setTaskStatusAction(task.id, next);
      if (!result.ok) {
        toast.error(result.error);
        setOverrides((current) => {
          const copy = { ...current };
          delete copy[task.id];
          return copy;
        });
      }
    });
  }

  const filtered = visible.filter(matches);
  const overdue = filtered.filter((task) => task.dueDate < today && statusOf(task) === "open");
  const weekTasks = filtered.filter((task) => task.dueDate >= week && task.dueDate <= addDaysISO(week, 6));

  const hours = useMemo(() => {
    const buckets = new Map<string, { minutes: number; tasks: { title: string; minutes: number }[] }>();
    for (const task of visible) {
      if (task.dueDate < `${season}-01-01` || task.dueDate > `${season}-12-31`) continue;
      const key = startOfWeekMonday(task.dueDate);
      const bucket = buckets.get(key) ?? { minutes: 0, tasks: [] };
      const minutes = minutesOf(task);
      bucket.minutes += minutes;
      bucket.tasks.push({ title: task.title, minutes });
      buckets.set(key, bucket);
    }
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [season, visible]);
  const peak = Math.max(60, ...hours.map(([, bucket]) => bucket.minutes));

  return (
    <div className="grid gap-6" data-testid="task-board">
      <PageHeader
        eyebrow={`Season ${season}`}
        title="Tasks"
        description="Jobs come from each planting. Tick them off, drag a card to another day, or add your own."
        actions={
          <Button
            type="button"
            data-testid="add-task"
            onClick={() => {
              setEditingId(null);
              setDraft({ title: "", taskType: "weeding", dueDate: today, notes: "", plantingId: "", minutes: 30, repeat: emptyRepeat(today) });
              setAdding(true);
            }}
          >
            <Plus /> Add task
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["week", "This week"],
            ["board", "Week board"],
            ["list", "All tasks"],
            ["hours", "Workload"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} type="button" size="sm" variant={view === id ? "default" : "outline"} data-testid={`tasks-${id}`} onClick={() => setView(id)}>
            {label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => chooseWeek(addDaysISO(week, -7))}>Previous week</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => chooseWeek(startOfWeekMonday(today))}>This week</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => chooseWeek(addDaysISO(week, 7))}>Next week</Button>
        <span className="self-center text-sm text-muted-foreground">{formatWeekRange(week)}</span>
      </div>

      {view === "list" ? (
        <div className="flex flex-wrap gap-2">
          <select className={controlClass + " max-w-40"} aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | "all")}>
            <option value="open">Not done</option>
            <option value="done">Done</option>
            <option value="all">All</option>
          </select>
          <select className={controlClass + " max-w-48"} aria-label="Type" value={type} onChange={(event) => setType(event.target.value as TaskType | "all")}>
            <option value="all">All types</option>
            {TASK_TYPE_CHOICES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            {customTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className={controlClass + " max-w-48"} aria-label="Block" value={blockId} onChange={(event) => setBlockId(event.target.value)}>
            <option value="all">All blocks</option>
            {blocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}
          </select>
          <select className={controlClass + " max-w-48"} aria-label="Crop" value={crop} onChange={(event) => setCrop(event.target.value)}>
            {crops.map((name) => <option key={name} value={name}>{name === "all" ? "All crops" : name}</option>)}
          </select>
        </div>
      ) : null}

      {view === "week" && visible.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground" data-testid="tasks-empty">
          No jobs for {season} yet. They appear when you add plantings.
        </p>
      ) : null}
      {view === "week" && visible.length > 0 ? (
        <div className="grid gap-4" data-testid="tasks-this-week">
          <TaskGroup title="Overdue" tasks={overdue} empty="Nothing overdue." statusOf={statusOf} onTick={tick} onEdit={openEdit} onDelete={(id) => void deleteTask(id, startTransition, () => router.refresh())} />
          {days.map((day) => (
            <TaskGroup
              key={day}
              title={formatWeekday(day)}
              tasks={weekTasks.filter((task) => task.dueDate === day)}
              empty="Nothing this day."
              statusOf={statusOf}
              onTick={tick}
              onEdit={openEdit}
              onDelete={(id) => void deleteTask(id, startTransition, () => router.refresh())}
            />
          ))}
        </div>
      ) : null}

      {view === "board" ? (
        <div className="grid gap-2 overflow-x-auto md:grid-cols-7" data-testid="week-board">
          {days.map((day) => (
            <section key={day} data-day={day} className="min-h-40 rounded-xl border bg-card p-2">
              <h2 className="text-xs font-medium text-muted-foreground">{formatWeekday(day)}</h2>
              <ul className="mt-2 grid gap-2">
                {weekTasks.filter((task) => task.dueDate === day).map((task) => (
                  <li key={task.id}>
                    <article
                      data-testid={`task-card-${task.id}`}
                      className="planting-card cursor-grab rounded-lg border bg-background p-2 text-sm"
                      onPointerDown={(event) => {
                        if (event.button !== 0 && event.pointerType === "mouse") return;
                        event.preventDefault();
                        dragId.current = task.id;
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        if (!dragId.current || !ghost.current) return;
                        ghost.current.hidden = false;
                        ghost.current.style.left = `${event.clientX}px`;
                        ghost.current.style.top = `${event.clientY}px`;
                        ghost.current.textContent = task.title;
                      }}
                      onPointerUp={(event) => {
                        const id = dragId.current;
                        dragId.current = null;
                        if (ghost.current) ghost.current.hidden = true;
                        const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-day]");
                        if (id && hit?.dataset.day && hit.dataset.day !== task.dueDate) {
                          startTransition(async () => {
                            const result = await rescheduleTaskAction(id, hit.dataset.day!);
                            if (!result.ok) toast.error(result.error);
                            else router.refresh();
                          });
                        }
                      }}
                    >
                      <label className="flex gap-2">
                        <Checkbox checked={statusOf(task) === "done"} onCheckedChange={(checked) => tick(task, checked === true)} />
                        <span>
                          <span className="block">{task.title}</span>
                          <span className="text-xs text-muted-foreground">{task.bedLabels ?? (task.cropName ? ukCropName(task.cropName) : "No bed")} · {minutesOf(task)} min</span>
                        </span>
                      </label>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div ref={ghost} hidden className="planting-ghost" data-testid="task-ghost" />
        </div>
      ) : null}

      {view === "list" ? (
        <ul className="grid gap-2" data-testid="task-list">
          {filtered.map((task) => (
            <li key={task.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card px-3 py-2">
              <label className="flex gap-2">
                <Checkbox checked={statusOf(task) === "done"} onCheckedChange={(checked) => tick(task, checked === true)} />
                <span>
                  <span className="block text-sm">{task.title}</span>
                  <span className="text-xs text-muted-foreground">{formatMedium(task.dueDate)} · {taskTypeLabel(task.taskType, customTypes)} · {task.bedLabels ?? "No bed"} · {minutesOf(task)} min</span>
                </span>
              </label>
              <span className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(task)}>Edit</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void deleteTask(task.id, startTransition, () => router.refresh())}>Delete</Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {view === "hours" ? <WorkloadChart season={season} hours={hours} peak={peak} /> : null}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="bg-card" data-testid="custom-task-dialog">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit task" : "Add a task"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const every = draft.repeat.repeat ? repeatIntervalDays(draft.repeat.every, draft.repeat.unit) : null;
                const attached = plantings.find((planting) => planting.id === draft.plantingId);
                const payload = {
                  title: draft.title,
                  taskType: draft.taskType,
                  dueDate: draft.dueDate,
                  notes: draft.notes,
                  plantingId: draft.plantingId || null,
                  minutes: draft.minutes,
                  repeatEveryDays: every,
                  repeatUntil: draft.repeat.repeat ? draft.repeat.until || attached?.lastHarvestDate || null : null,
                };
                const result = editingId ? await updateTaskAction(editingId, payload) : await createTaskAction(payload);
                if (!result.ok) toast.error(result.error);
                else {
                  setAdding(false);
                  setEditingId(null);
                  setDraft({ ...draft, title: "", notes: "", repeat: emptyRepeat(today) });
                  router.refresh();
                }
              });
            }}
          >
            <Field label="Task"><Input data-testid="task-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></Field>
            <Field label="Date"><Input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} required /></Field>
            <Field label="Type">
              <TaskTypeSelect
                value={draft.taskType}
                custom={customTypes}
                onChange={(taskType) => setDraft({ ...draft, taskType })}
                onCreated={(type) => setCustomTypes((current) => current.some((item) => item.id === type.id) ? current : [...current, type])}
              />
            </Field>
            <Field label="Attached planting (optional)">
              <select className={controlClass} value={draft.plantingId} onChange={(event) => setDraft({ ...draft, plantingId: event.target.value })}>
                <option value="">None</option>
                {plantings.map((planting) => (
                  <option key={planting.id} value={planting.id}>{ukCropName(planting.cropName)} · {planting.cultivar}</option>
                ))}
              </select>
            </Field>
            <Field label="Minutes"><Input type="number" min={5} value={draft.minutes} onChange={(event) => setDraft({ ...draft, minutes: Number(event.target.value) })} /></Field>
            <RepeatFields value={draft.repeat} onChange={(repeat) => setDraft({ ...draft, repeat })} untilHint="For a job on its own, pick the last day. A job on a planting repeats until the end of that harvest if you leave the date blank." />
            <Field label="Notes"><Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
            <Button type="submit" data-testid="save-task" disabled={pending}>Save task</Button>
          </form>
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">
        A task you drag to another day, or that you have ticked off, stays put if the planting dates later change.{" "}
        <Link href="/veg/plan" className="underline-offset-2 hover:underline">Plantings live on the game plan.</Link>
      </p>
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  empty,
  statusOf,
  onTick,
  onEdit,
  onDelete,
}: {
  title: string;
  tasks: TaskView[];
  empty: string;
  statusOf: (task: TaskView) => TaskStatus;
  onTick: (task: TaskView, done: boolean) => void;
  onEdit: (task: TaskView) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="font-display text-xl">{title}</h2>
      {tasks.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">{empty}</p> : (
        <ul className="mt-2 grid gap-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card px-3 py-2">
              <label className="flex gap-2">
                <Checkbox checked={statusOf(task) === "done"} onCheckedChange={(checked) => onTick(task, checked === true)} />
                <span>
                  <span className="block text-sm">{task.title}</span>
                  <span className="text-xs text-muted-foreground">{task.bedLabels ?? "No bed yet"} · {minutesOf(task)} min</span>
                </span>
              </label>
              <span className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(task)}>Edit</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(task.id)}>Delete</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const WEEK_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function weekLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  const name = WEEK_MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${name}`;
}

/** Even hour marks, with the top mark strictly above the tallest bar. */
function hourScale(peakMinutes: number): { max: number; ticks: number[] } {
  const hours = Math.max(peakMinutes / 60, 0.5);
  const step = hours <= 4 ? 1 : hours <= 10 ? 2 : hours <= 25 ? 5 : 10;
  let max = Math.ceil(hours / step) * step;
  if (max <= hours) max += step;
  const ticks = [];
  for (let value = 0; value <= max + 1e-6; value += step) ticks.push(value);
  return { max, ticks };
}

function WorkloadChart({
  season,
  hours,
  peak,
}: {
  season: number;
  hours: [string, { minutes: number; tasks: { title: string; minutes: number }[] }][];
  peak: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const plot = 220;
  const scale = hourScale(peak);
  const step = hours.length > 20 ? 4 : hours.length > 12 ? 2 : 1;
  const active = hours.find(([start]) => start === hover)?.[1];
  const scroll = hours.length > 48;
  return (
    <div data-testid="workload" className="rounded-2xl border bg-card p-4 pt-5 sm:p-5 sm:pt-6">
      <h2 className="font-display text-2xl">Estimated hours per week</h2>
      <p className="mt-1 text-sm text-muted-foreground">Season {season}. Each bar is one week.</p>
      {active && hover ? (
        <div className="mt-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm" data-testid="workload-tooltip">
          <p className="font-medium">
            Week of {weekLabel(hover)} · {(active.minutes / 60).toFixed(1)} hours
          </p>
          <ul className="mt-1 grid gap-0.5 text-muted-foreground">
            {active.tasks
              .slice()
              .sort((a, b) => b.minutes - a.minutes)
              .slice(0, 6)
              .map((task) => (
                <li key={`${task.title}-${task.minutes}`}>
                  {task.title} · {task.minutes} min
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Hover a bar for the hours and the jobs in that week.</p>
      )}
      <div className={`mt-2 ${scroll ? "overflow-x-auto" : ""}`}>
        <div className={scroll ? "min-w-[920px]" : ""}>
          <div className="flex gap-2 pt-3">
            <div className="relative w-14 shrink-0" style={{ height: plot }}>
              <span className="absolute top-1/2 -left-1 -translate-y-1/2 -rotate-90 text-[11px] tracking-wide whitespace-nowrap text-muted-foreground">
                Hours
              </span>
              {scale.ticks.map((tick) => {
                const atTop = tick === scale.max;
                const atBottom = tick === 0;
                return (
                  <span
                    key={tick}
                    className={`absolute right-0 text-[12px] leading-none whitespace-nowrap text-muted-foreground ${atTop ? "" : atBottom ? "-translate-y-full" : "-translate-y-1/2"}`}
                    style={{ top: `${(1 - tick / scale.max) * plot}px` }}
                  >
                    {tick}
                  </span>
                );
              })}
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative border-b border-l border-border" style={{ height: plot }}>
                {scale.ticks.map((tick) => (
                  <span
                    key={tick}
                    className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-border/80"
                    style={{ top: `${(1 - tick / scale.max) * 100}%` }}
                  />
                ))}
                <div className="absolute inset-x-1 bottom-0 flex items-end gap-px" style={{ height: plot }}>
                  {hours.map(([start, bucket]) => {
                    const height = Math.max(3, (bucket.minutes / (scale.max * 60)) * (plot - 4));
                    return (
                      <button
                        key={start}
                        type="button"
                        aria-label={`${weekLabel(start)}, ${(bucket.minutes / 60).toFixed(1)} hours`}
                        className="flex h-full min-w-0 flex-1 items-end"
                        onMouseEnter={() => setHover(start)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(start)}
                        onBlur={() => setHover(null)}
                      >
                        <span className={`w-full rounded-t ${hover === start ? "bg-primary" : "bg-primary/85"}`} style={{ height }} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="relative mt-2 h-6">
                {hours.map(([start], index) => {
                  if (index % step !== 0) return null;
                  const atStart = index < step;
                  const atEnd = index > hours.length - step - 1;
                  return (
                    <span
                      key={start}
                      className={`absolute top-0 text-[11px] leading-none whitespace-nowrap text-muted-foreground ${atStart ? "left-0" : atEnd ? "right-0" : "-translate-x-1/2"}`}
                      style={atStart || atEnd ? undefined : { left: `${((index + 0.5) / hours.length) * 100}%` }}
                    >
                      {weekLabel(start)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function deleteTask(id: string, startTransition: (callback: () => void) => void, refresh: () => void) {
  startTransition(async () => {
    const result = await deleteTaskAction(id);
    if (!result.ok) toast.error(result.error);
    else refresh();
  });
}
