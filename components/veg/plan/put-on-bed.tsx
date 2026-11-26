"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { assignPlantingBedsAction } from "@/app/veg/actions";
import { Button } from "@/components/veg/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/veg/ui/dialog";
import { ukCropName } from "@/lib/veg/crop-names";
import { formatMedium } from "@/lib/veg/dates";
import { availabilityFor, type BedOccupancy, type BedSlot } from "@/lib/veg/planting-form";
import type { PlantingView } from "@/lib/veg/views";

export function PutOnBedDialog({
  planting,
  beds,
  occupancy,
  noteFor,
  onAssigned,
  open,
  onOpenChange,
}: {
  planting: PlantingView | null;
  beds: BedSlot[];
  occupancy: BedOccupancy[];
  noteFor?: (bedId: string) => string | null;
  onAssigned?: (plantingId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!planting) return null;
  const marks = availabilityFor(beds, occupancy, planting.fieldPlantingDate, planting.lastHarvestDate, planting.id);
  const free = marks.filter((mark) => mark.status === "free");
  const busyBeds = marks.filter((mark) => mark.status === "clash");
  const byId = new Map(beds.map((bed) => [bed.id, bed]));

  async function choose(bedId: string) {
    setBusy(true);
    setError(null);
    const result = await assignPlantingBedsAction(planting!.id, bedId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAssigned?.(planting!.id);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card" data-testid="put-on-bed">
        <DialogHeader>
          <DialogTitle>Put on a bed</DialogTitle>
          <DialogDescription>
            {ukCropName(planting.cropName)} · {planting.cultivar} needs the bed from {formatMedium(planting.fieldPlantingDate)} until{" "}
            {formatMedium(planting.lastHarvestDate)}. Nursery time does not use a bed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-4 pb-4">
          <p className="text-sm text-muted-foreground">Free for those dates</p>
          <ul className="grid gap-1">
            {free.map((mark) => {
              const bed = byId.get(mark.bedId);
              if (!bed) return null;
              return (
                <li key={mark.bedId}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    data-testid={`pick-bed-${mark.bedId}`}
                    disabled={busy}
                    onClick={() => void choose(mark.bedId)}
                  >
                    <span className="grid text-left">
                      <span>{bed.label}</span>
                      {noteFor?.(mark.bedId) ? <span className="text-xs font-normal text-muted-foreground">{noteFor(mark.bedId)}</span> : null}
                    </span>
                  </Button>
                </li>
              );
            })}
            {free.length === 0 ? <li className="text-sm text-muted-foreground">No bed is free for the whole spell.</li> : null}
          </ul>
          {busyBeds.length > 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Busy: {busyBeds.map((mark) => byId.get(mark.bedId)?.label).filter(Boolean).join(", ")}.
            </p>
          ) : null}
          {error ? <p className="text-sm text-warning-foreground">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
