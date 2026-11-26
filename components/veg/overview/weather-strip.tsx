import { formatMedium } from "@/lib/veg/dates";

export type ForecastDay = {
  date: string;
  min: number | null;
  max: number | null;
  code: number | null;
};

function weatherKind(code: number | null): "sun" | "fair" | "cloud" | "fog" | "rain" | "snow" | "storm" {
  if (code == null) return "cloud";
  if (code === 0) return "sun";
  if (code <= 2) return "fair";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "rain";
}

const WORD = {
  sun: "Clear",
  fair: "Fair",
  cloud: "Cloud",
  fog: "Fog",
  rain: "Rain",
  snow: "Snow",
  storm: "Storm",
} as const;

function Icon({ kind }: { kind: keyof typeof WORD }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      {kind === "sun" || kind === "fair" ? (
        <g {...common}>
          <circle cx={kind === "fair" ? 12 : 16} cy={kind === "fair" ? 12 : 16} r="4.5" />
          <path d="M12 3.5v2.5M12 18v2.5M3.5 12h2.5M18 12h2.5M6 6l1.8 1.8M16.2 16.2 18 18M18 6l-1.8 1.8M7.8 16.2 6 18" transform={kind === "fair" ? "" : "translate(4 4)"} />
        </g>
      ) : null}
      {kind === "fair" ? <path d="M12 22h12a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4-.6" {...common} /> : null}
      {kind === "cloud" || kind === "fog" || kind === "rain" || kind === "snow" || kind === "storm" ? (
        <path d="M8 18h15a5 5 0 0 0 .4-10 6.5 6.5 0 0 0-12.4-.4" {...common} />
      ) : null}
      {kind === "fog" ? <path d="M8 23h15M11 27h10" {...common} /> : null}
      {kind === "rain" ? <path d="M12 23l-2 5M18 23l-2 5M24 23l-2 5" {...common} /> : null}
      {kind === "snow" ? <path d="M12 23v5M10 25.5h4M18 23v5M16 25.5h4M24 23v5M22 25.5h4" {...common} /> : null}
      {kind === "storm" ? <path d="M18 21l-4 6h4l-3 6" {...common} strokeLinejoin="round" /> : null}
    </svg>
  );
}

export function WeatherStrip({ days }: { days: ForecastDay[] | null }) {
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5" data-testid="weather">
      <h2 className="font-display text-2xl">The next seven days</h2>
      {days ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {days.map((day) => {
            const frostNight = day.min != null && day.min <= 0;
            const risk = day.min != null && day.min <= 2 && !frostNight;
            const kind = weatherKind(day.code);
            return (
              <li
                key={day.date}
                className={`flex min-h-36 flex-col items-start gap-1 rounded-xl px-3 py-3 ${frostNight ? "bg-warning text-warning-foreground" : risk ? "bg-accent/60" : "bg-muted/70"}`}
              >
                <span className="text-sm font-medium">{formatMedium(day.date)}</span>
                <Icon kind={kind} />
                <span className="text-xs">{WORD[kind]}</span>
                <span className="num text-lg leading-none">
                  {day.max == null ? "–" : `${Math.round(day.max)}°`}
                  <span className="text-sm"> / {day.min == null ? "–" : `${Math.round(day.min)}°`}</span>
                </span>
                {frostNight ? <span className="mt-auto rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-medium">Frost</span> : null}
                {risk ? <span className="mt-auto rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-medium">Risk</span> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">The forecast is not available just now. The rest of the plan still works.</p>
      )}
    </section>
  );
}
