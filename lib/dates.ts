/** All calendar maths uses UTC dates so a server in any timezone agrees with the tests. */

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

export function addWeeks(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7);
}

export function diffDays(fromIso: string, toIso: string): number {
  const ms = parseISODate(toIso).getTime() - parseISODate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

export function addYears(iso: string, years: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const targetYear = year + years;
  const date = new Date(Date.UTC(targetYear, month - 1, day));
  if (date.getUTCMonth() !== month - 1) {
    return formatISODate(new Date(Date.UTC(targetYear, month, 0)));
  }
  return formatISODate(date);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Day-of-year with 29 February collapsed, so medians don't jump in leap years. */
export function nonLeapDayOfYear(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  const date = Date.UTC(year, month - 1, day === 29 && month === 2 ? 28 : day);
  const start = Date.UTC(year, 0, 1);
  let doy = Math.floor((date - start) / 86_400_000) + 1;
  if (isLeapYear(year) && month > 2) doy -= 1;
  return doy;
}

export function monthDayToIso(year: number, month: number, day: number): string {
  return formatISODate(new Date(Date.UTC(year, month - 1, day)));
}

export function doyToMonthDay(doy: number): { month: number; day: number } {
  const date = new Date(Date.UTC(2025, 0, doy));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function monthDayToDoy(month: number, day: number): number {
  return nonLeapDayOfYear(monthDayToIso(2025, month, day));
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Monday-first week, as used in the UK and most of Europe. */
export function startOfWeekMonday(iso: string): string {
  const day = parseISODate(iso).getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(iso, offset);
}

export function formatDate(iso: string, options?: { withYear?: boolean }): string {
  const date = parseISODate(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: options?.withYear === false ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateShort(iso: string): string {
  const date = parseISODate(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthDay(month: number, day: number): string {
  return formatDate(monthDayToIso(2025, month, day), { withYear: false });
}

export function todayISO(now = new Date()): string {
  return formatISODate(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  );
}

export function defaultSeasonYear(
  hemisphere: "north" | "south",
  today = todayISO(),
): number {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  if (hemisphere === "north") return month >= 9 ? year + 1 : year;
  return month >= 7 ? year : year - 1;
}
