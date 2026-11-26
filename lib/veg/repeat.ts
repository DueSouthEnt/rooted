import { addDaysISO } from "@/lib/veg/dates";

export const MAX_REPEAT_DAYS = 49;

export const REPEAT_PRESETS: { label: string; days: number }[] = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "5 days", days: 5 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "3 weeks", days: 21 },
  { label: "4 weeks", days: 28 },
  { label: "5 weeks", days: 35 },
  { label: "6 weeks", days: 42 },
  { label: "7 weeks", days: 49 },
];

export function repeatIntervalDays(every: number, unit: "days" | "weeks"): number | null {
  if (!Number.isFinite(every) || every < 1) return null;
  const days = unit === "weeks" ? Math.round(every) * 7 : Math.round(every);
  if (days < 1 || days > MAX_REPEAT_DAYS) return null;
  return days;
}

/** Dates from the start through the end, stepping by a whole number of days. */
export function repeatDates(start: string, everyDays: number, until: string): string[] {
  if (!start || everyDays < 1 || everyDays > MAX_REPEAT_DAYS || !until || until < start) return start ? [start] : [];
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= until && dates.length < 120) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, everyDays);
  }
  return dates;
}

export function slugTaskType(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug ? `type-${slug}` : "";
}
