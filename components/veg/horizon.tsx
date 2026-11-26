import { addDaysISO, diffDays, eachWeek, formatMedium, monthShort, startOfWeekMonday, yearOf } from "@/lib/veg/dates";
import { textOn } from "@/lib/veg/planning";
import { cn } from "@/lib/veg/utils";

export type HorizonBar = {
  id: string;
  start: string;
  end: string;
  color: string;
  label: string;
  title: string;
  hatch?: boolean;
  conflict?: boolean;
  alert?: boolean;
};

export type HorizonRow = {
  id: string;
  label: string;
  sublabel?: string;
  swatch?: string;
  bars: HorizonBar[];
};

export type HorizonSection = {
  id: string;
  title: string;
  meta?: string;
  swatch?: string;
  rows: HorizonRow[];
};

const WEEK = 32;
const GUTTER = 176;

export function Horizon({
  sections,
  today,
  empty,
}: {
  sections: HorizonSection[];
  today: string;
  empty?: string;
}) {
  const dates = sections.flatMap((section) =>
    section.rows.flatMap((row) => row.bars.flatMap((bar) => [bar.start, bar.end])),
  );
  if (!dates.length) {
    return (
      <div className="rounded-2xl border bg-card px-5 py-10 text-sm text-muted-foreground">
        {empty ?? "Nothing is scheduled in this view yet."}
      </div>
    );
  }
  const sorted = [...dates].sort();
  const rangeStart = startOfWeekMonday(addDaysISO(sorted[0]!, -3));
  const rangeEnd = startOfWeekMonday(addDaysISO(sorted[sorted.length - 1]!, 7));
  const weeks = eachWeek(rangeStart, rangeEnd);
  const width = GUTTER + weeks.length * WEEK;
  const showToday = today >= rangeStart && today <= addDaysISO(rangeEnd, 6);
  const todayLeft = GUTTER + (diffDays(today, rangeStart) / 7) * WEEK;

  const months: { label: string; count: number }[] = [];
  for (const week of weeks) {
    const mid = addDaysISO(week, 3);
    const label = `${monthShort(mid)} ${yearOf(mid)}`;
    const last = months[months.length - 1];
    if (last && last.label === label) last.count += 1;
    else months.push({ label, count: 1 });
  }

  return (
    <div className="overflow-auto rounded-2xl border bg-card shadow-[0_1px_0_rgba(60,40,10,0.04)]">
      <div className="relative" style={{ width }}>
        {showToday ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-clay/80"
            style={{ left: todayLeft }}
          >
            <span className="absolute top-1 left-1 rounded bg-clay px-1 py-0.5 text-[10px] text-primary-foreground">
              Today
            </span>
          </div>
        ) : null}
        <div className="sticky top-0 z-30 border-b bg-card">
          <div className="flex">
            <div
              className="sticky left-0 z-40 shrink-0 border-r bg-card"
              style={{ width: GUTTER }}
            />
            <div className="flex">
              {months.map((month) => (
                <div
                  key={month.label}
                  className="border-l px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                  style={{ width: month.count * WEEK }}
                >
                  {month.label}
                </div>
              ))}
            </div>
          </div>
          <div className="flex border-t">
            <div
              className="sticky left-0 z-40 shrink-0 border-r bg-card px-3 py-1 text-[11px] text-muted-foreground"
              style={{ width: GUTTER }}
            >
              Week of
            </div>
            <div className="flex">
              {weeks.map((week) => (
                <div
                  key={week}
                  className="num border-l py-1 text-center text-[10px] text-muted-foreground"
                  style={{ width: WEEK }}
                >
                  {formatMedium(week).split(" ")[1]}
                </div>
              ))}
            </div>
          </div>
        </div>
        {sections.map((section) => (
          <section key={section.id}>
            <div className="flex border-t bg-muted/70">
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-muted/95 px-3 py-1.5"
                style={{ width: GUTTER }}
              >
                {section.swatch ? (
                  <span className="size-2.5 rounded-full" style={{ background: section.swatch }} />
                ) : null}
                <span className="truncate text-sm font-medium">{section.title}</span>
              </div>
              <div className="flex items-center px-3 text-xs text-muted-foreground">{section.meta}</div>
            </div>
            {section.rows.map((row) => (
              <HorizonRowView
                key={row.id}
                row={row}
                rangeStart={rangeStart}
                trackWidth={weeks.length * WEEK}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function HorizonRowView({
  row,
  rangeStart,
  trackWidth,
}: {
  row: HorizonRow;
  rangeStart: string;
  trackWidth: number;
}) {
  const sorted = [...row.bars].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const laneEnds: string[] = [];
  const placed = sorted.map((bar) => {
    let lane = laneEnds.findIndex((end) => end < bar.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(bar.end);
    } else {
      laneEnds[lane] = bar.end;
    }
    return { bar, lane };
  });
  const lanes = Math.max(1, laneEnds.length);
  const height = lanes * 24 + 10;
  return (
    <div className="flex border-t" style={{ height }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-card px-3"
        style={{ width: GUTTER }}
      >
        {row.swatch ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: row.swatch }} /> : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.label}</div>
          {row.sublabel ? <div className="truncate text-[11px] text-muted-foreground">{row.sublabel}</div> : null}
        </div>
      </div>
      <div className="relative" style={{ width: trackWidth }}>
        {placed.length === 0 ? (
          <span className="absolute top-2 left-2 text-[11px] text-muted-foreground">Open</span>
        ) : null}
        {placed.map(({ bar, lane }) => {
          const left = (diffDays(bar.start, rangeStart) / 7) * WEEK;
          const width = Math.max(((diffDays(bar.end, bar.start) + 1) / 7) * WEEK - 3, 6);
          return (
            <div
              key={bar.id}
              title={bar.title}
              className={cn(
                "absolute flex items-center overflow-hidden rounded-[4px] px-1 text-[10px] font-medium",
                bar.hatch && "bg-hatch text-primary-foreground",
                bar.conflict && "ring-2 ring-clay",
              )}
              style={{
                left,
                width,
                top: 6 + lane * 24,
                height: 18,
                background: bar.hatch ? undefined : bar.color,
                color: bar.hatch ? undefined : textOn(bar.color),
              }}
            >
              {bar.alert ? <span className="mr-1">!</span> : null}
              <span className="truncate">{width > 56 ? bar.label : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
