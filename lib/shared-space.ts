/** A planting's claim on a shared bed, in metres and calendar days. */
export type ShareUse = {
  id: string;
  kind: "flower" | "veg";
  label: string;
  start: string;
  end: string;
  lengthM: number;
};

export type ShareClash = {
  bedName: string;
  bedLengthM: number;
  usedM: number;
  start: string;
  labels: string[];
};

const SLACK_M = 0.05;

/**
 * The bed is too full on a day when every planting active that day
 * asks for more length than the bed has. Dates are inclusive.
 * Plantings that miss each other on the calendar never clash.
 */
export function sharedClashes(bedName: string, bedLengthM: number, uses: ShareUse[]): ShareClash[] {
  const events: { day: string; delta: number; use: ShareUse }[] = [];
  for (const use of uses) {
    if (!(use.lengthM > 0) || !use.start || !use.end || use.end < use.start) continue;
    events.push({ day: use.start, delta: 1, use });
    events.push({ day: use.end, delta: -1, use });
  }
  events.sort((a, b) => a.day.localeCompare(b.day) || b.delta - a.delta);

  const active = new Map<string, ShareUse>();
  const clashes: ShareClash[] = [];
  const seen = new Set<string>();
  let index = 0;
  while (index < events.length) {
    const day = events[index].day;
    const batch: typeof events = [];
    while (index < events.length && events[index].day === day) batch.push(events[index++]);
    for (const event of batch) {
      if (event.delta > 0) active.set(event.use.id, event.use);
    }
    const current = [...active.values()];
    const used = current.reduce((sum, use) => sum + use.lengthM, 0);
    if (current.length > 1 && used > bedLengthM + SLACK_M) {
      const labels = current.map((use) => use.label).sort((a, b) => a.localeCompare(b, "en-GB"));
      const key = current
        .map((use) => use.id)
        .sort()
        .join("|");
      if (!seen.has(key)) {
        seen.add(key);
        clashes.push({
          bedName,
          bedLengthM,
          usedM: Math.round(used * 10) / 10,
          start: day,
          labels,
        });
      }
    }
    for (const event of batch) {
      if (event.delta < 0) active.delete(event.use.id);
    }
  }
  return clashes;
}

export function clashSentence(clash: ShareClash): string {
  const length = clash.bedLengthM.toFixed(1).replace(/\.0$/, "");
  const used = clash.usedM.toFixed(1).replace(/\.0$/, "");
  return `${clash.bedName} is ${length} m long, and ${clash.labels.join(" and ")} want ${used} m of it at the same time.`;
}
