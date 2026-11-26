"use client";

import { useState } from "react";
import { PlantingDialog } from "@/components/planting-dialog";
import { formatDateShort } from "@/lib/dates";
import type { Flower } from "@/lib/flower";
import type { PlantingDates } from "@/lib/schedule";
import type { SitePlan } from "@/lib/tasks";

export function PlantsBoard({
  farmId,
  plantings,
  flowers,
  site,
  season,
  bedNames,
  defaultBedLengthM = 15,
}: {
  farmId: string;
  plantings: PlantingDates[];
  flowers: Flower[];
  site: SitePlan | null;
  season: number;
  bedNames: Record<string, string>;
  defaultBedLengthM?: number;
}) {
  const [dialog, setDialog] = useState<PlantingDates | null | "new">(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Plants · {season}</p>
          <h1 className="font-heading text-4xl">Plantings</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Add a flower here before it has a bed. The dates are worked out from your frost dates, and you can change any of them.
          </p>
        </div>
        <button type="button" className="h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground" onClick={() => setDialog("new")} data-testid="open-planting-dialog">
          Add a planting
        </button>
      </div>
      <ul className="space-y-2">
        {plantings.length === 0 ? <li className="text-sm text-muted-foreground">No plantings yet. The first one will wait in the year plan until you drag it onto a bed.</li> : null}
        {plantings.map((planting) => (
          <li key={planting.id}>
            <button type="button" className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-left" onClick={() => setDialog(planting)}>
              <span className="block font-medium">
                {planting.flowerName}
                {planting.variety ? ` · ${planting.variety}` : ""}
              </span>
              <span className="text-sm text-muted-foreground">
                {planting.method === "indoor" ? "Under cover" : "Into the bed"} · plant {formatDateShort(planting.fieldDate)} · flower {formatDateShort(planting.bloomStart)} – {formatDateShort(planting.bloomEnd)}
                {" · "}
                {(planting.bedIds && planting.bedIds.length ? planting.bedIds : planting.bedId ? [planting.bedId] : []).map((id) => bedNames[id] ?? "A bed").join(", ") || "Unplanted"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <PlantingDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        farmId={farmId}
        flowers={flowers}
        site={site}
        season={season}
        defaultBedLengthM={defaultBedLengthM}
        editing={dialog && dialog !== "new" ? dialog : null}
        successionCount={
          dialog && dialog !== "new" && dialog.successionGroup
            ? plantings.filter((item) => item.successionGroup === dialog.successionGroup).length
            : 1
        }
      />
    </div>
  );
}
