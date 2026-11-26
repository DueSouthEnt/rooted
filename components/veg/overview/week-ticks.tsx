"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setTaskStatusAction } from "@/app/veg/actions";
import { Checkbox } from "@/components/veg/ui/checkbox";
import { formatMedium } from "@/lib/veg/dates";

export function WeekTicks({
  tasks,
}: {
  tasks: { id: string; title: string; dueDate: string; done: boolean }[];
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  if (tasks.length === 0) return <p className="mt-3 text-sm text-muted-foreground">Nothing else due this week.</p>;
  return (
    <ul className="mt-3 grid gap-2">
      {tasks.map((task) => {
        const done = overrides[task.id] ?? task.done;
        return (
          <li key={task.id}>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={done}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setOverrides((current) => ({ ...current, [task.id]: next }));
                  startTransition(async () => {
                    const result = await setTaskStatusAction(task.id, next ? "done" : "open");
                    if (!result.ok) {
                      toast.error(result.error);
                      setOverrides((current) => {
                        const copy = { ...current };
                        delete copy[task.id];
                        return copy;
                      });
                    }
                  });
                }}
              />
              <span>
                <span className="block">{task.title}</span>
                <span className="text-xs text-muted-foreground">{formatMedium(task.dueDate)}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
