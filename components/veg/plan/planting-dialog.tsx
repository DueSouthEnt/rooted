"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createPlantingsAction, updatePlantingAction } from "@/app/veg/actions";
import { controlClass, Field } from "@/components/veg/field";
import { Button } from "@/components/veg/ui/button";
import { Checkbox } from "@/components/veg/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/veg/ui/dialog";
import { Input } from "@/components/veg/ui/input";
import { Textarea } from "@/components/veg/ui/textarea";
import { ukCropName } from "@/lib/veg/crop-names";
import { formatLong, formatMedium } from "@/lib/veg/dates";
import { METHOD_LABEL } from "@/lib/veg/labels";
import { plantingFrostWarnings } from "@/lib/veg/frost";
import { buildPlan, occupantsFor } from "@/lib/veg/planning";
import type { DateMode, Placement, PlantingMethod, Unit } from "@/lib/veg/types";
import { formatNumber } from "@/lib/veg/units";
import type { BlockView, CropView, PlantingView } from "@/lib/veg/views";
import { cn } from "@/lib/veg/utils";

type Draft = {
  cropId: string;
  plantingMethod: PlantingMethod;
  dateMode: DateMode;
  anchorDate: string;
  blockId: string;
  bedIds: string[];
  unassignedBedCount: number;
  unassignedBedLength: number;
  unassignedUnit: Unit;
  successionEnabled: boolean;
  successionCount: number;
  successionIntervalDays: number;
  placement: Placement;
  bedsPerPlanting: number;
  followUpEnabled: boolean;
  followUpCropId: string;
  followUpGapDays: number;
  notes: string;
  acknowledgeOverlaps: boolean;
};

function initialDraft(
  planting: PlantingView | null,
  crops: CropView[],
  blocks: BlockView[],
  today: string,
): Draft {
  const crop = crops.find((item) => item.id === planting?.cropId) ?? crops[0];
  const blockId = planting?.beds[0]?.blockId ?? "";
  const block = blocks.find((item) => item.id === blockId);
  return {
    cropId: crop?.id ?? "",
    plantingMethod: planting?.plantingMethod ?? crop?.plantingMethod ?? "direct_seeded",
    dateMode: planting?.dateMode ?? "field_planting",
    anchorDate: planting?.anchorDate ?? today,
    blockId,
    bedIds: planting?.beds.map((bed) => bed.id) ?? [],
    unassignedBedCount: 1,
    unassignedBedLength: block?.bedLength ?? blocks[0]?.bedLength ?? 100,
    unassignedUnit: block?.unit ?? blocks[0]?.unit ?? "ft",
    successionEnabled: false,
    successionCount: 4,
    successionIntervalDays: 14,
    placement: "rotate",
    bedsPerPlanting: 1,
    followUpEnabled: false,
    followUpCropId: crops.find((item) => item.id !== crop?.id)?.id ?? crop?.id ?? "",
    followUpGapDays: 1,
    notes: planting?.notes ?? "",
    acknowledgeOverlaps: false,
  };
}

export function PlantingDialog({
  open,
  onOpenChange,
  planting,
  crops,
  blocks,
  plantings,
  season,
  today,
  frost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planting: PlantingView | null;
  crops: CropView[];
  blocks: BlockView[];
  plantings: PlantingView[];
  season: number;
  today: string;
  frost: { label: string; lastSpringFrost: string; firstAutumnFrost: string } | null;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(planting, crops, blocks, today));
  const [pending, startTransition] = useTransition();
  const editing = Boolean(planting);

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({
      ...current,
      ...patch,
      acknowledgeOverlaps: patch.acknowledgeOverlaps ?? false,
    }));
  }

  const block = blocks.find((item) => item.id === draft.blockId);
  const crop = crops.find((item) => item.id === draft.cropId);
  const preview = useMemo(() => {
    const existing = occupantsFor(
      plantings
        .filter((item) => item.id !== planting?.id)
        .map((item) => ({
          key: item.id,
          label: `${ukCropName(item.cropName)} · ${item.cultivar}`,
          bedIds: item.beds.map((bed) => bed.id),
          bedLabels: item.beds.map((bed) => bed.label),
          start: item.fieldPlantingDate,
          end: item.lastHarvestDate,
        })),
    );
    return buildPlan(
      {
        cropId: draft.cropId,
        plantingMethod: draft.plantingMethod,
        dateMode: draft.dateMode,
        anchorDate: draft.anchorDate,
        bedIds: draft.bedIds,
        unassignedBedCount: draft.unassignedBedCount,
        unassignedBedLength: draft.unassignedBedLength,
        unassignedUnit: draft.unassignedUnit,
        successionCount: editing || !draft.successionEnabled ? 1 : draft.successionCount,
        successionIntervalDays: draft.successionIntervalDays,
        placement: draft.placement,
        bedsPerPlanting: draft.bedsPerPlanting,
        followUpCropId: editing || !draft.followUpEnabled ? null : draft.followUpCropId,
        followUpGapDays: draft.followUpGapDays,
        notes: draft.notes,
      },
      crops,
      blocks.flatMap((item) =>
        item.beds.map((bed) => ({
          id: bed.id,
          label: bed.label,
          blockId: item.id,
          blockName: item.name,
          length: bed.length,
          width: bed.width,
          unit: item.unit,
        })),
      ),
      existing,
    );
  }, [blocks, crops, draft, editing, planting?.id, plantings]);

  const overlaps = preview.ok ? preview.overlaps : [];
  const frostNotes = useMemo(() => {
    if (!preview.ok || !frost) return [];
    return preview.plantings.flatMap((item) => {
      const tolerance = crops.find((crop) => crop.id === item.cropId)?.frostTolerance ?? null;
      return plantingFrostWarnings({
        tolerance,
        fieldPlantingDate: item.schedule.fieldPlantingDate,
        lastHarvestDate: item.schedule.lastHarvestDate,
        lastSpringFrost: frost.lastSpringFrost,
        firstAutumnFrost: frost.firstAutumnFrost,
      }).warnings.map((warning) => ({
        key: `${item.key}-${warning.code}`,
        message: `${ukCropName(item.cropName)} · ${item.cultivar}: ${warning.message}`,
        suggested: warning.suggestedFieldDate,
      }));
    });
  }, [crops, frost, preview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit planting" : "Plan a planting"}</DialogTitle>
          <DialogDescription>
            Lock either the field date or the first harvest. Sprout Logic fills in the nursery, the last harvest, and the yield.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!preview.ok) {
              toast.error(preview.error);
              return;
            }
            startTransition(async () => {
              const result = editing
                ? await updatePlantingAction({
                    id: planting?.id,
                    cropId: draft.cropId,
                    plantingMethod: draft.plantingMethod,
                    dateMode: draft.dateMode,
                    anchorDate: draft.anchorDate,
                    bedIds: draft.bedIds,
                    unassignedBedCount: draft.unassignedBedCount,
                    unassignedBedLength: draft.unassignedBedLength,
                    unassignedUnit: draft.unassignedUnit,
                    notes: draft.notes,
                    acknowledgeOverlaps: draft.acknowledgeOverlaps,
                  })
                : await createPlantingsAction({
                    cropId: draft.cropId,
                    plantingMethod: draft.plantingMethod,
                    dateMode: draft.dateMode,
                    anchorDate: draft.anchorDate,
                    bedIds: draft.bedIds,
                    unassignedBedCount: draft.unassignedBedCount,
                    unassignedBedLength: draft.unassignedBedLength,
                    unassignedUnit: draft.unassignedUnit,
                    successionCount: draft.successionEnabled ? draft.successionCount : 1,
                    successionIntervalDays: draft.successionIntervalDays,
                    placement: draft.placement,
                    bedsPerPlanting: draft.bedsPerPlanting,
                    followUpCropId: draft.followUpEnabled ? draft.followUpCropId : null,
                    followUpGapDays: draft.followUpGapDays,
                    notes: draft.notes,
                    acknowledgeOverlaps: draft.acknowledgeOverlaps,
                    seasonYear: season,
                  });
              if (!result.ok) {
                toast.error(result.error);
                if (result.overlaps?.length) update({ acknowledgeOverlaps: false });
                return;
              }
              toast.success(editing ? "Planting updated." : "Planting added to the game plan.");
              onOpenChange(false);
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Crop">
              <select
                className={controlClass}
                value={draft.cropId}
                onChange={(event) => {
                  const next = crops.find((item) => item.id === event.target.value);
                  update({
                    cropId: event.target.value,
                    plantingMethod: next?.plantingMethod ?? draft.plantingMethod,
                  });
                }}
              >
                {crops.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.cultivar}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Method">
              <select
                className={controlClass}
                value={draft.plantingMethod}
                onChange={(event) => update({ plantingMethod: event.target.value as PlantingMethod })}
              >
                <option value="direct_seeded">Direct seeded</option>
                <option value="transplanted">Transplanted</option>
              </select>
            </Field>
          </div>
          {crop ? (
            <p className="text-xs leading-5 text-muted-foreground num">
              {METHOD_LABEL[crop.plantingMethod]} template · {crop.daysToMaturity} days to maturity
              {crop.plantingMethod === "transplanted" ? ` · ${crop.daysInNursery} days in the nursery` : ""}
              {" · "}
              {crop.harvestWindowDays}-day harvest · {crop.rowsPerBed} rows at {formatNumber(crop.inRowSpacingIn, 1)} in ·{" "}
              {formatNumber(crop.yieldPer100BedFeet, 0)} {crop.yieldUnit} / 100 bed-ft
            </p>
          ) : null}

          <Field label="Block">
            <select
              className={controlClass}
              value={draft.blockId}
              onChange={(event) => {
                const next = blocks.find((item) => item.id === event.target.value);
                update({
                  blockId: event.target.value,
                  bedIds: [],
                  unassignedBedLength: next?.bedLength ?? draft.unassignedBedLength,
                  unassignedUnit: next?.unit ?? draft.unassignedUnit,
                });
              }}
            >
              <option value="">Unassigned — plan by bed-feet</option>
              {blocks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          {block ? (
            <div>
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Beds</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {block.beds.map((bed) => {
                  const on = draft.bedIds.includes(bed.id);
                  return (
                    <button
                      key={bed.id}
                      type="button"
                      onClick={() =>
                        update({
                          bedIds: on ? draft.bedIds.filter((id) => id !== bed.id) : [...draft.bedIds, bed.id],
                        })
                      }
                      className={cn(
                        "rounded-full px-3 py-1 text-xs num",
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {bed.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {draft.bedIds.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Bed count">
                <Input type="number" min={1} className="num" value={draft.unassignedBedCount} onChange={(event) => update({ unassignedBedCount: Number(event.target.value) })} />
              </Field>
              <Field label="Bed length">
                <Input type="number" min={0.1} step="0.1" className="num" value={draft.unassignedBedLength} onChange={(event) => update({ unassignedBedLength: Number(event.target.value) })} />
              </Field>
              <Field label="Length unit">
                <select className={controlClass} value={draft.unassignedUnit} onChange={(event) => update({ unassignedUnit: event.target.value as Unit })}>
                  <option value="ft">Feet</option>
                  <option value="m">Metres</option>
                </select>
              </Field>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date to lock">
              <select className={controlClass} value={draft.dateMode} onChange={(event) => update({ dateMode: event.target.value as DateMode })}>
                <option value="field_planting">Field planting date</option>
                <option value="target_harvest">Target first harvest</option>
              </select>
            </Field>
            <Field label={draft.dateMode === "field_planting" ? "Field planting date" : "Target first harvest"}>
              <Input type="date" className="num" value={draft.anchorDate} onChange={(event) => update({ anchorDate: event.target.value })} required />
            </Field>
          </div>

          {editing ? null : (
            <div className="grid gap-3 rounded-xl border bg-muted/40 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.successionEnabled} onCheckedChange={(checked) => update({ successionEnabled: checked })} />
                Succession planting
              </label>
              {draft.successionEnabled ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Number of plantings" hint="Includes the first one.">
                    <Input type="number" min={2} max={24} className="num" value={draft.successionCount} onChange={(event) => update({ successionCount: Number(event.target.value) })} />
                  </Field>
                  <Field label="Days between them" hint="Steps the date you locked, field or harvest.">
                    <Input type="number" min={1} className="num" value={draft.successionIntervalDays} onChange={(event) => update({ successionIntervalDays: Number(event.target.value) })} />
                  </Field>
                  <Field label="Bed placement">
                    <select className={controlClass} value={draft.placement} onChange={(event) => update({ placement: event.target.value as Placement })}>
                      <option value="rotate">Rotate through the selected beds</option>
                      <option value="same_beds">Same beds for every planting</option>
                    </select>
                  </Field>
                  <Field label="Beds used each time">
                    <Input type="number" min={1} className="num" value={draft.bedsPerPlanting} disabled={draft.placement === "same_beds"} onChange={(event) => update({ bedsPerPlanting: Number(event.target.value) })} />
                  </Field>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.followUpEnabled} onCheckedChange={(checked) => update({ followUpEnabled: checked })} />
                Follow-up crop in the same beds after harvest
              </label>
              {draft.followUpEnabled ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Follow-up crop">
                    <select className={controlClass} value={draft.followUpCropId} onChange={(event) => update({ followUpCropId: event.target.value })}>
                      {crops.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.cultivar}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Days after last harvest" hint="1 plants the next day. 0 shares the last harvest day and will warn.">
                    <Input type="number" min={0} className="num" value={draft.followUpGapDays} onChange={(event) => update({ followUpGapDays: Number(event.target.value) })} />
                  </Field>
                </div>
              ) : null}
            </div>
          )}

          <Field label="Notes">
            <Textarea value={draft.notes} onChange={(event) => update({ notes: event.target.value })} />
          </Field>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-left tracking-wide text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">Planting</th>
                  <th className="px-2 py-2 font-medium">Beds</th>
                  <th className="px-2 py-2 font-medium">Nursery</th>
                  <th className="px-2 py-2 font-medium">Field</th>
                  <th className="px-2 py-2 font-medium">Harvest</th>
                  <th className="px-2 py-2 font-medium">Yield</th>
                </tr>
              </thead>
              <tbody>
                {!preview.ok ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-destructive">
                      {preview.error}
                    </td>
                  </tr>
                ) : (
                  preview.plantings.map((item) => {
                    const conflict = overlaps.some((overlap) => overlap.leftKey === item.key || overlap.rightKey === item.key);
                    return (
                      <tr key={item.key} className={cn("border-b last:border-0", conflict && "bg-warning")}>
                        <td className="px-2 py-2">
                          {ukCropName(item.cropName)} · {item.cultivar}
                          {item.successionIndex ? ` (${item.successionIndex}/${item.successionCount})` : ""}
                          {item.isFollowUp ? " · follow-up" : ""}
                        </td>
                        <td className="px-2 py-2 num">{item.bedLabels.join(", ") || "Unassigned"}</td>
                        <td className="px-2 py-2 num">{item.schedule.nurseryStartDate ? formatMedium(item.schedule.nurseryStartDate) : "—"}</td>
                        <td className="px-2 py-2 num">{formatMedium(item.schedule.fieldPlantingDate)}</td>
                        <td className="px-2 py-2 num">
                          {formatMedium(item.schedule.firstHarvestDate)}–{formatMedium(item.schedule.lastHarvestDate)}
                        </td>
                        <td className="px-2 py-2 num">
                          {formatNumber(item.predictedYield, 1)} {item.yieldUnit}
                          <span className="block text-muted-foreground">{formatNumber(item.bedFeet, 1)} bed-ft</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {frostNotes.length > 0 ? (
            <div className="rounded-xl border border-warning-border bg-warning p-3 text-sm text-warning-foreground">
              <p className="font-medium">Frost warning · {frost?.label}</p>
              <ul className="mt-2 grid gap-1 text-xs leading-5">
                {frostNotes.slice(0, 6).map((note) => (
                  <li key={note.key}>
                    {note.message}
                    {note.suggested ? ` A safer field date is ${formatMedium(note.suggested)}.` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {overlaps.length > 0 ? (
            <div className="rounded-xl border border-warning-border bg-warning p-3 text-sm text-warning-foreground">
              <p className="font-medium">These beds are already occupied.</p>
              <ul className="mt-2 grid gap-1 text-xs leading-5">
                {overlaps.slice(0, 6).map((overlap) => (
                  <li key={`${overlap.bedId}-${overlap.leftKey}-${overlap.rightKey}`}>
                    {overlap.bedLabel}: {overlap.leftLabel} ({formatLong(overlap.leftStart)}–{formatLong(overlap.leftEnd)}) overlaps {overlap.rightLabel} ({formatLong(overlap.rightStart)}–{formatLong(overlap.rightEnd)}).
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.acknowledgeOverlaps}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, acknowledgeOverlaps: checked }))}
                />
                Save anyway. I know these dates share a bed.
              </label>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || !preview.ok || (overlaps.length > 0 && !draft.acknowledgeOverlaps)}>
              {pending
                ? "Saving…"
                : editing
                  ? "Save planting"
                  : `Create ${preview.ok ? preview.plantings.length : ""} planting${preview.ok && preview.plantings.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
