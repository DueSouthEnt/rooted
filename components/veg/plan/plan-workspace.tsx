"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { deletePlantingAction } from "@/app/veg/actions";
import { AddPlantingDialog } from "@/components/veg/plan/add-planting-dialog";
import { PageHeader } from "@/components/veg/page-header";
import { Button } from "@/components/veg/ui/button";
import { Input } from "@/components/veg/ui/input";
import { gardenerBedName } from "@/lib/veg/bed-name";
import { cropMatchesQuery, ukCropName } from "@/lib/veg/crop-names";
import { formatMedium } from "@/lib/veg/dates";
import { METHOD_LABEL } from "@/lib/veg/labels";
import type { FrostContext } from "@/lib/veg/queries";
import type { BlockView, CropView, PlantingView, TaskView } from "@/lib/veg/views";

export function PlanWorkspace({
  crops,
  blocks,
  plantings,
  season,
  today,
  initialEditId,
  frost,
  tasks = [],
  standardBedLengthM = 15,
}: {
  crops: CropView[];
  blocks: BlockView[];
  plantings: PlantingView[];
  season: number;
  today: string;
  initialEditId: string | null;
  frost: FrostContext | null;
  frostRiskIds?: string[];
  tasks?: TaskView[];
  standardBedLengthM?: number;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(initialEditId);
  const [pending, startTransition] = useTransition();
  const editing = plantings.find((planting) => planting.id === editingId) ?? null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return plantings.filter((planting) => {
      const beds = planting.beds.map((bed) => gardenerBedName(bed.blockName, bed.position)).join(" ");
      return cropMatchesQuery(planting.cropName, `${planting.cultivar} ${beds}`, needle);
    });
  }, [plantings, query]);

  return (
    <div className="grid gap-6" data-testid="game-plan">
      <PageHeader
        eyebrow={`Season ${season}`}
        title="Game plan"
        description="Enter every planting for the season here, then place them on beds in Year plan."
        actions={
          <Button
            type="button"
            data-testid="game-plan-add"
            onClick={() => {
              setEditingId(null);
              setCreating(true);
            }}
          >
            <Plus />
            Add planting
          </Button>
        }
      />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search crop, variety, or bed"
        aria-label="Search plantings"
        className="max-w-xs"
      />
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            <tr className="border-b">
              <th className="px-3 py-3 font-medium">Crop</th>
              <th className="px-3 py-3 font-medium">Variety</th>
              <th className="px-3 py-3 font-medium">Method</th>
              <th className="px-3 py-3 font-medium">Field date</th>
              <th className="px-3 py-3 font-medium">Harvest</th>
              <th className="px-3 py-3 font-medium">Beds needed</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-muted-foreground">
                  {plantings.length === 0 ? `No plantings for ${season} yet.` : "Nothing matches that search."}
                </td>
              </tr>
            ) : (
              filtered.map((planting) => {
                const placed = planting.beds.length > 0;
                return (
                  <tr
                    key={planting.id}
                    data-testid={`plan-row-${planting.id}`}
                    className="cursor-pointer border-b align-top last:border-0 hover:bg-muted/40"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(planting.id);
                    }}
                  >
                    <td className="px-3 py-3 font-medium">{ukCropName(planting.cropName)}</td>
                    <td className="px-3 py-3">{planting.cultivar}</td>
                    <td className="px-3 py-3">{METHOD_LABEL[planting.plantingMethod]}</td>
                    <td className="px-3 py-3 num">{formatMedium(planting.fieldPlantingDate)}</td>
                    <td className="px-3 py-3 num">
                      {formatMedium(planting.firstHarvestDate)} – {formatMedium(planting.lastHarvestDate)}
                    </td>
                    <td className="px-3 py-3 num">{planting.bedsNeeded}</td>
                    <td className="px-3 py-3">
                      {placed ? (
                        <span className="text-xs">
                          On {planting.beds.map((bed) => gardenerBedName(bed.blockName, bed.position)).join(", ")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-warning px-2 py-0.5 text-xs text-warning-foreground">Not on a bed</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {placed ? null : (
                          <Link
                            href={`/timeline?group=bed&place=${planting.id}`}
                            className="text-sm text-primary underline-offset-2 hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Place on a bed
                          </Link>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!window.confirm(`Delete ${ukCropName(planting.cropName)} · ${planting.cultivar}?`)) return;
                            startTransition(async () => {
                              const result = await deletePlantingAction(planting.id);
                              if (!result.ok) toast.error(result.error);
                            });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <AddPlantingDialog
        key={editing?.id ?? (creating ? "new" : "closed")}
        open={creating || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditingId(null);
          }
        }}
        editing={editing}
        tasks={tasks}
        crops={crops}
        season={season}
        today={today}
        frost={frost}
        defaultBedLengthM={standardBedLengthM}
      />
    </div>
  );
}
