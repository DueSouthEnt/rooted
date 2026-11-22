"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBedBlock, duplicateBedBlock, updateBedBlock } from "@/lib/actions";
import { packedSpanM } from "@/lib/blocks";
import { formatSquareMetres } from "@/lib/geo";
import type { BlockRecord } from "@/lib/records";

export function BlockPanel({ farmId, block }: { farmId: string; block: BlockRecord }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const span = packedSpanM(block.bed_count, block.bed_width_cm / 100, block.path_width_cm / 100);
  const area = block.bed_length_m * span;

  async function patch(change: Parameters<typeof updateBedBlock>[2]) {
    setBusy(true);
    const result = await updateBedBlock(farmId, block.id, change);
    setBusy(false);
    if (result && "error" in result && result.error) {
      setNote(result.error);
      return;
    }
    setNote("");
    router.refresh();
  }

  return (
    <aside className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{block.area_name}</p>
      <label className="block text-sm">
        Block name
        <input
          defaultValue={block.name}
          key={block.name}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== block.name) void patch({ name });
          }}
          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
        />
      </label>
      <p className="font-heading text-3xl">{formatSquareMetres(area)}</p>
      <p className="text-sm text-muted-foreground">
        {block.bed_length_m.toFixed(1)} m long · {span.toFixed(1)} m across · {block.bed_count} beds
      </p>
      <Stepper
        label="Bed width"
        value={block.bed_width_cm}
        unit="cm"
        onMinus={() => void patch({ bedWidthCm: Math.max(20, block.bed_width_cm - 5) })}
        onPlus={() => void patch({ bedWidthCm: Math.min(400, block.bed_width_cm + 5) })}
        disabled={busy}
      />
      <Stepper
        label="Path width"
        value={block.path_width_cm}
        unit="cm"
        onMinus={() => void patch({ pathWidthCm: Math.max(0, block.path_width_cm - 5) })}
        onPlus={() => void patch({ pathWidthCm: Math.min(300, block.path_width_cm + 5) })}
        disabled={busy}
      />
      <Stepper
        label="Number of beds"
        value={block.bed_count}
        unit=""
        onMinus={() => void patch({ count: Math.max(1, block.bed_count - 1) })}
        onPlus={() => void patch({ count: Math.min(400, block.bed_count + 1) })}
        disabled={busy}
      />
      <label className="block text-sm">
        Rotation, clockwise from north: {Math.round(block.rotation_deg)}°
        <input
          type="range"
          min={0}
          max={180}
          value={block.rotation_deg}
          disabled={busy}
          onChange={(event) => void patch({ rotationDeg: Number(event.target.value) })}
          className="mt-2 w-full accent-[var(--primary)]"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="h-11 rounded-full border border-border px-4 text-sm"
          onClick={() => {
            setBusy(true);
            void duplicateBedBlock(farmId, block.id).then(() => {
              setBusy(false);
              router.refresh();
            });
          }}
        >
          Duplicate
        </button>
        <button
          type="button"
          disabled={busy}
          className="h-11 rounded-full border border-destructive/40 px-4 text-sm text-destructive"
          onClick={() => {
            setBusy(true);
            void deleteBedBlock(farmId, block.id).then(() => router.refresh());
          }}
        >
          Delete block
        </button>
      </div>
      {note ? <p className="text-sm text-destructive">{note}</p> : null}
      <p className="text-xs text-muted-foreground">Each stripe is its own bed. Plantings stay on the beds you keep when the block reflows.</p>
    </aside>
  );
}

function Stepper({
  label,
  value,
  unit,
  onMinus,
  onPlus,
  disabled,
}: {
  label: string;
  value: number;
  unit: string;
  onMinus: () => void;
  onPlus: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>
        {label}
        <strong className="ml-2">
          {value}
          {unit ? ` ${unit}` : ""}
        </strong>
      </span>
      <span className="flex gap-1">
        <button type="button" disabled={disabled} onClick={onMinus} className="size-9 rounded-full border border-border" aria-label={`Fewer ${label}`}>
          −
        </button>
        <button type="button" disabled={disabled} onClick={onPlus} className="size-9 rounded-full border border-border" aria-label={`More ${label}`}>
          +
        </button>
      </span>
    </div>
  );
}
