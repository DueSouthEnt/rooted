const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Calendar dates are UTC date-only strings (YYYY-MM-DD) so a server timezone cannot shift them. */
export function parseISODate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(now = new Date()): string {
  return formatISODate(now);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  if (!date) throw new Error(`Invalid date: ${iso}`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

export function diffDays(later: string, earlier: string): number {
  const a = parseISODate(later);
  const b = parseISODate(earlier);
  if (!a || !b) throw new Error(`Invalid date range: ${earlier} → ${later}`);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function startOfWeekMonday(iso: string): string {
  const date = parseISODate(iso);
  if (!date) throw new Error(`Invalid date: ${iso}`);
  const weekday = date.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addDaysISO(iso, delta);
}

export function formatMedium(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatLong(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatWeekday(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  return `${WEEKDAYS[date.getUTCDay()]}, ${formatMedium(iso)}`;
}

export function formatWeekRange(weekStart: string): string {
  const start = parseISODate(weekStart);
  if (!start) return weekStart;
  const endIso = addDaysISO(weekStart, 6);
  const end = parseISODate(endIso);
  if (!end) return weekStart;
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${formatMedium(weekStart)} – ${formatMedium(endIso)}, ${start.getUTCFullYear()}`;
  }
  return `${formatLong(weekStart)} – ${formatLong(endIso)}`;
}

export function monthName(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][date.getUTCMonth()];
}

export function monthShort(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return iso;
  return MONTHS[date.getUTCMonth()];
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function eachWeek(start: string, end: string): string[] {
  const weeks: string[] = [];
  let cursor = startOfWeekMonday(start);
  const last = startOfWeekMonday(end);
  while (cursor <= last) {
    weeks.push(cursor);
    cursor = addDaysISO(cursor, 7);
  }
  return weeks;
}
