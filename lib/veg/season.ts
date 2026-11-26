import { cookies } from "next/headers";
import { todayISO } from "@/lib/veg/dates";

export async function getSeason(): Promise<number> {
  const jar = await cookies();
  const raw = jar.get("tilth_season")?.value;
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) return parsed;
  return Number(todayISO().slice(0, 4));
}

export function seasonChoices(current: number, inDatabase: number[]): number[] {
  const years = new Set<number>([current - 1, current, current + 1, ...inDatabase]);
  return [...years].filter((year) => year >= 2000 && year <= 2100).sort((a, b) => a - b);
}
