"use client";

import { useTransition } from "react";
import { setSeasonAction } from "@/app/veg/actions";

export function SeasonSwitcher({ season, years }: { season: number; years: number[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Season</span>
      <select
        aria-label="Season"
        className="h-8 rounded-lg border border-input bg-card px-2 text-sm num outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={season}
        disabled={pending}
        onChange={(event) => {
          const year = Number(event.target.value);
          startTransition(() => {
            void setSeasonAction(year);
          });
        }}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
