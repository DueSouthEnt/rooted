import { formatDateShort, formatMonthDay } from "@/lib/dates";
import { RHS_BLURB, type RhsRating } from "@/lib/hardiness";
import type { FarmRecord } from "@/lib/records";
import type { SitePlan } from "@/lib/tasks";

export function FrostStamp({ farm, site }: { farm: FarmRecord; site: SitePlan | null }) {
  const rhs = site?.rhs as RhsRating | null;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
        {farm.place_name || "Place not set"} {farm.country ? `· ${farm.country}` : ""}
      </p>
      {site?.frostFree ? (
        <p className="font-heading mt-1 text-2xl text-foreground">Frost is rare here</p>
      ) : site ? (
        <p className="font-heading mt-1 text-2xl text-foreground">
          Last frost {formatDateShort(site.lastSpringFrost)}
          <span className="text-muted-foreground"> · </span>
          First frost {formatDateShort(site.firstAutumnFrost)}
        </p>
      ) : (
        <p className="font-heading mt-1 text-2xl">No frost dates yet</p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {site ? `${site.seasonLengthDays} day season` : "Set a place to calculate the season"}
        {site?.usdaZone ? ` · USDA ${site.usdaZone}` : ""}
        {rhs ? ` · RHS ${rhs}` : ""}
        {site ? ` · ${site.summer} summer` : ""}
        {` · ${farm.season_year} season`}
      </p>
      {rhs ? <p className="mt-1 text-xs text-muted-foreground">{RHS_BLURB[rhs]}</p> : null}
      {farm.frost_source ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Source: {farm.frost_source === "open-meteo" ? "Open-Meteo history" : farm.frost_source === "station" ? "nearby reference place" : "your dates"}
          {farm.last_spring_month && !farm.frost_free
            ? ` · typical last frost ${formatMonthDay(farm.last_spring_month, farm.last_spring_day ?? 1)}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
