"use client";

import { useState } from "react";
import { createTaskTypeAction } from "@/app/veg/actions";
import { controlClass, Field } from "@/components/veg/field";
import { Button } from "@/components/veg/ui/button";
import { Input } from "@/components/veg/ui/input";
import { TASK_TYPE_CHOICES, taskTypeLabel } from "@/lib/veg/labels";
import { REPEAT_PRESETS, repeatIntervalDays } from "@/lib/veg/repeat";

export type RepeatDraft = {
  repeat: boolean;
  every: number;
  unit: "days" | "weeks";
  until: string;
};

export function emptyRepeat(until = ""): RepeatDraft {
  return { repeat: false, every: 1, unit: "weeks", until };
}

export function TaskTypeSelect({
  value,
  custom,
  onChange,
  onCreated,
}: {
  value: string;
  custom: { id: string; name: string }[];
  onChange: (id: string) => void;
  onCreated: (type: { id: string; name: string }) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const choices = [...TASK_TYPE_CHOICES, ...custom.map((item) => ({ id: item.id, label: item.name }))];
  return (
    <div className="grid gap-2">
      <select
        className={controlClass}
        aria-label="Task type"
        data-testid="task-type"
        value={choices.some((item) => item.id === value) ? value : "weeding"}
        onChange={(event) => {
          if (event.target.value === "__new__") {
            setAdding(true);
            return;
          }
          onChange(event.target.value);
        }}
      >
        {choices.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
        <option value="__new__">Add new task type…</option>
      </select>
      {adding ? (
        <div className="flex flex-wrap gap-2" data-testid="new-task-type">
          <Input value={name} placeholder="Name the task type" aria-label="New task type" onChange={(event) => setName(event.target.value)} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void (async () => {
                const result = await createTaskTypeAction(name);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                onCreated(result.data);
                onChange(result.data.id);
                setAdding(false);
                setName("");
                setError(null);
              })();
            }}
          >
            Save type
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-warning-foreground">{error}</p> : null}
      <span className="sr-only">{taskTypeLabel(value, custom)}</span>
    </div>
  );
}

export function RepeatFields({
  value,
  onChange,
  untilHint,
}: {
  value: RepeatDraft;
  onChange: (next: RepeatDraft) => void;
  untilHint?: string;
}) {
  const days = value.repeat ? repeatIntervalDays(value.every, value.unit) : null;
  return (
    <div className="grid gap-2">
      <Field label="Repeat?">
        <select
          className={controlClass}
          data-testid="repeat-toggle"
          value={value.repeat ? "yes" : "no"}
          onChange={(event) => onChange({ ...value, repeat: event.target.value === "yes" })}
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      {value.repeat ? (
        <div className="grid gap-2" data-testid="repeat-controls">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Every" className="w-28">
              <Input
                type="number"
                min={1}
                max={value.unit === "weeks" ? 7 : 49}
                value={value.every}
                onChange={(event) => onChange({ ...value, every: Number(event.target.value) })}
              />
            </Field>
            <Field label="Unit" className="w-36">
              <select
                className={controlClass}
                value={value.unit}
                onChange={(event) => onChange({ ...value, unit: event.target.value as "days" | "weeks" })}
              >
                <option value="days">days</option>
                <option value="weeks">weeks</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-1">
            {REPEAT_PRESETS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                className="rounded-full border bg-card px-2 py-1 text-xs"
                onClick={() =>
                  onChange({
                    ...value,
                    every: preset.days % 7 === 0 ? preset.days / 7 : preset.days,
                    unit: preset.days % 7 === 0 ? "weeks" : "days",
                  })
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Field label="Repeat until" hint={untilHint ?? "Repeats stop on this date. Seven weeks is the longest gap."}>
            <Input type="date" value={value.until} onChange={(event) => onChange({ ...value, until: event.target.value })} />
          </Field>
          {days == null ? <p className="text-sm text-warning-foreground">Use a gap from 1 day up to 7 weeks.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
