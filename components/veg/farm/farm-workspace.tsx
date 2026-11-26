"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addBedAction,
  deleteBedAction,
  deleteBlockAction,
  saveBedAction,
  saveBlockAction,
} from "@/app/veg/actions";
import { controlClass, Field } from "@/components/veg/field";
import { PageHeader, Stat } from "@/components/veg/page-header";
import { Button } from "@/components/veg/ui/button";
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
import { BLOCK_TYPE_LABEL } from "@/lib/veg/labels";
import { plantingPhase, textOn } from "@/lib/veg/planning";
import type { BlockType, Unit } from "@/lib/veg/types";
import { formatDimension, formatNumber, summarizeBeds, toFeet } from "@/lib/veg/units";
import type { BlockView, PlantingView } from "@/lib/veg/views";
import { cn } from "@/lib/veg/utils";

type BlockDraft = {
  id?: string;
  name: string;
  type: BlockType;
  bedCount: number;
  bedLength: number;
  bedWidth: number;
  pathWidth: number;
  unit: Unit;
  notes: string;
};

const EMPTY_BLOCK: BlockDraft = {
  name: "",
  type: "open_field",
  bedCount: 4,
  bedLength: 100,
  bedWidth: 2.5,
  pathWidth: 1.5,
  unit: "ft",
  notes: "",
};

export function FarmWorkspace({
  blocks,
  plantings,
  today,
  season,
}: {
  blocks: BlockView[];
  plantings: PlantingView[];
  today: string;
  season: number;
}) {
  const [selectedBed, setSelectedBed] = useState<string | null>(blocks[0]?.beds[0]?.id ?? null);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [bedEdit, setBedEdit] = useState<{ id: string; label: string; length: number; width: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const summary = summarizeBeds(blocks);
  const longest = Math.max(
    1,
    ...blocks.flatMap((block) => block.beds.map((bed) => toFeet(bed.length, block.unit))),
  );
  const pxPerFoot = Math.min(7.5, 760 / longest);

  const occupancy = useMemo(() => {
    const map = new Map<string, PlantingView[]>();
    for (const planting of plantings) {
      for (const bed of planting.beds) {
        const list = map.get(bed.id) ?? [];
        list.push(planting);
        map.set(bed.id, list);
      }
    }
    return map;
  }, [plantings]);

  const selected = blocks.flatMap((block) => block.beds.map((bed) => ({ bed, block }))).find((item) => item.bed.id === selectedBed);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That change didn't save.");
        return;
      }
      toast.success(success);
      setBlockDraft(null);
      setBedEdit(null);
    });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={`Season ${season}`}
        title="Farm map"
        description="Blocks and beds drawn to scale. A bed takes the colour of whatever is in the ground today."
        actions={
          <Button onClick={() => setBlockDraft(EMPTY_BLOCK)}>
            <Plus />
            Add block
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Beds" value={formatNumber(summary.bedCount, 0)} detail="Across every block" />
        <Stat label="Bed-feet" value={formatNumber(summary.bedFeet, 0)} detail="Length of growing bed" />
        <Stat label="Growing area" value={formatNumber(summary.areaSqFt, 0)} detail="Square feet, paths excluded" />
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-2xl border bg-card px-5 py-10 text-sm text-muted-foreground">
          The map is empty. Add an open field, greenhouse, or high tunnel to start laying out beds.
        </div>
      ) : null}

      <div className="grid gap-5">
        {blocks.map((block) => {
          const metrics = summarizeBeds([block]);
          const gap = Math.max(6, toFeet(block.pathWidth, block.unit) * pxPerFoot);
          return (
            <section key={block.id} className="rounded-2xl border bg-card p-4 shadow-[0_1px_0_rgba(60,40,10,0.04)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl">{block.name}</h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{BLOCK_TYPE_LABEL[block.type]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {block.beds.length} beds · {formatNumber(metrics.bedFeet, 0)} bed-ft · {formatNumber(metrics.areaSqFt, 0)} ft²
                    {" · "}
                    {formatDimension(block.bedWidth, block.unit)} wide · {formatDimension(block.pathWidth, block.unit)} paths
                  </p>
                  {block.notes ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{block.notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBlockDraft({
                        id: block.id,
                        name: block.name,
                        type: block.type,
                        bedCount: block.beds.length,
                        bedLength: block.bedLength,
                        bedWidth: block.bedWidth,
                        pathWidth: block.pathWidth,
                        unit: block.unit,
                        notes: block.notes,
                      })
                    }
                  >
                    Edit block
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => run(() => addBedAction(block.id), `Added a bed to ${block.name}.`)}>
                    <Plus />
                    Add bed
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Remove ${block.name}? Plantings stay in the game plan and lose this bed assignment.`)) {
                        run(() => deleteBlockAction(block.id), `${block.name} was removed.`);
                      }
                    }}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <div className="flex min-w-max gap-3">
                  <div className="flex flex-col" style={{ gap }}>
                    {block.beds.map((bed) => (
                      <div
                        key={bed.label}
                        className="flex items-center text-xs font-medium num"
                        style={{ height: Math.max(22, toFeet(bed.width, block.unit) * pxPerFoot) }}
                      >
                        {bed.label}
                      </div>
                    ))}
                  </div>
                  <div
                    className={cn(
                      "rounded-xl p-3",
                      block.type === "greenhouse" && "bg-[var(--bed-house)] ring-1 ring-[var(--wheat)]",
                      block.type === "high_tunnel" && "bg-[var(--bed-tunnel)] ring-1 ring-[var(--clay)]",
                      block.type === "open_field" && "bg-[var(--bed-path)]",
                    )}
                  >
                    <div className="flex flex-col" style={{ gap }}>
                      {block.beds.map((bed) => {
                        const active = (occupancy.get(bed.id) ?? []).find(
                          (planting) =>
                            planting.fieldPlantingDate <= today && planting.lastHarvestDate >= today,
                        );
                        const background = active?.color ?? "var(--bed-soil)";
                        return (
                          <button
                            key={bed.id}
                            type="button"
                            onClick={() => setSelectedBed(bed.id)}
                            className={cn(
                              "relative overflow-hidden rounded-[4px] text-left ring-offset-2 transition",
                              selectedBed === bed.id && "ring-2 ring-primary",
                            )}
                            style={{
                              width: Math.max(48, toFeet(bed.length, block.unit) * pxPerFoot),
                              height: Math.max(22, toFeet(bed.width, block.unit) * pxPerFoot),
                              background,
                              color: active ? textOn(active.color) : "var(--bed-ink)",
                            }}
                            aria-pressed={selectedBed === bed.id}
                            aria-label={`${bed.label}${active ? `, ${active.cropName}` : ", open"}`}
                          >
                            {toFeet(bed.length, block.unit) * pxPerFoot > 140 ? (
                              <span className="absolute top-1 left-2 truncate text-[11px] font-medium">
                                {active ? `${active.cropName} · ${active.cultivar}` : "Open"}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block h-2 rounded-sm bg-foreground/70" style={{ width: pxPerFoot * 10 }} />
                  <span className="num">10 ft</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {selected ? (
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">
                {selected.bed.label}
                <span className="ml-2 text-base text-muted-foreground">{selected.block.name}</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground num">
                {formatDimension(selected.bed.length, selected.block.unit)} long · {formatDimension(selected.bed.width, selected.block.unit)} wide
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setBedEdit({
                    id: selected.bed.id,
                    label: selected.bed.label,
                    length: selected.bed.length,
                    width: selected.bed.width,
                  })
                }
              >
                Edit bed
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Delete ${selected.bed.label}? This is blocked if a planting still uses it.`)) {
                    run(() => deleteBedAction(selected.bed.id), `${selected.bed.label} was deleted.`);
                  }
                }}
              >
                Delete bed
              </Button>
            </div>
          </div>
          <ul className="mt-4 grid gap-2">
            {(occupancy.get(selected.bed.id) ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">No {season} planting is assigned to this bed.</li>
            ) : (
              (occupancy.get(selected.bed.id) ?? []).map((planting) => (
                <li key={planting.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: planting.color }} />
                    <span className="text-sm font-medium">
                      {planting.cropName} · {planting.cultivar}
                    </span>
                    <span className="text-xs text-muted-foreground">{plantingPhase(planting, today).replaceAll("_", " ")}</span>
                  </div>
                  <span className="text-xs text-muted-foreground num">
                    {planting.fieldPlantingDate} → {planting.lastHarvestDate}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      <Dialog open={blockDraft !== null} onOpenChange={(open) => !open && setBlockDraft(null)}>
        <DialogContent className="sm:max-w-lg" style={{ maxWidth: 560 }}>
          <DialogHeader>
            <DialogTitle>{blockDraft?.id ? "Edit block" : "Add a block"}</DialogTitle>
            <DialogDescription>
              Bed length, width, and path width are drawn to scale. Switching units does not convert the numbers.
            </DialogDescription>
          </DialogHeader>
          {blockDraft ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const draft = blockDraft;
                run(() => saveBlockAction(draft), draft.id ? "Block updated." : "Block added.");
              }}
            >
              <Field label="Name">
                <Input value={blockDraft.name} onChange={(event) => setBlockDraft({ ...blockDraft, name: event.target.value })} required />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  <select className={controlClass} value={blockDraft.type} onChange={(event) => setBlockDraft({ ...blockDraft, type: event.target.value as BlockType })}>
                    <option value="open_field">Open field</option>
                    <option value="greenhouse">Greenhouse</option>
                    <option value="high_tunnel">High tunnel / caterpillar</option>
                  </select>
                </Field>
                <Field label="Unit">
                  <select className={controlClass} value={blockDraft.unit} onChange={(event) => setBlockDraft({ ...blockDraft, unit: event.target.value as Unit })}>
                    <option value="ft">Feet</option>
                    <option value="m">Metres</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Number of beds">
                  <Input type="number" min={1} className="num" value={blockDraft.bedCount} onChange={(event) => setBlockDraft({ ...blockDraft, bedCount: Number(event.target.value) })} />
                </Field>
                <Field label="Bed length" hint={blockDraft.unit === "ft" ? "Along the row" : "Along the row, in metres"}>
                  <Input type="number" min={0.1} step="0.1" className="num" value={blockDraft.bedLength} onChange={(event) => setBlockDraft({ ...blockDraft, bedLength: Number(event.target.value) })} />
                </Field>
                <Field label="Bed width" hint="2.5 ft is a 30-inch bed">
                  <Input type="number" min={0.1} step="0.1" className="num" value={blockDraft.bedWidth} onChange={(event) => setBlockDraft({ ...blockDraft, bedWidth: Number(event.target.value) })} />
                </Field>
                <Field label="Path width">
                  <Input type="number" min={0} step="0.1" className="num" value={blockDraft.pathWidth} onChange={(event) => setBlockDraft({ ...blockDraft, pathWidth: Number(event.target.value) })} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={blockDraft.notes} onChange={(event) => setBlockDraft({ ...blockDraft, notes: event.target.value })} />
              </Field>
              {blockDraft.id ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Beds that still match the previous length and width pick up the new size. A bed you resized by hand keeps its own dimensions. Shortening the block removes empty beds from the end.
                </p>
              ) : null}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save block"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={bedEdit !== null} onOpenChange={(open) => !open && setBedEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit bed</DialogTitle>
            <DialogDescription>Length and width stay in the block&apos;s unit.</DialogDescription>
          </DialogHeader>
          {bedEdit ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const draft = bedEdit;
                run(() => saveBedAction(draft), "Bed updated.");
              }}
            >
              <Field label="Label">
                <Input value={bedEdit.label} onChange={(event) => setBedEdit({ ...bedEdit, label: event.target.value })} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Length">
                  <Input type="number" min={0.1} step="0.1" className="num" value={bedEdit.length} onChange={(event) => setBedEdit({ ...bedEdit, length: Number(event.target.value) })} />
                </Field>
                <Field label="Width">
                  <Input type="number" min={0.1} step="0.1" className="num" value={bedEdit.width} onChange={(event) => setBedEdit({ ...bedEdit, width: Number(event.target.value) })} />
                </Field>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save bed"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
