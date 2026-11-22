"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlantingDragSurface } from "@/components/planting-drag";
import { formatDateShort } from "@/lib/dates";
import { fitLabel } from "@/lib/recommend";
import { addPlanting } from "@/lib/actions";
import type { SowSuggestion } from "@/lib/schedule";

export function SowNowCard({
  farmId,
  suggestions,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  farmId: string;
  suggestions: SowSuggestion[];
  draggable?: boolean;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onDrop?: (id: string, point: { x: number; y: number }) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function add(item: SowSuggestion) {
    setBusy(item.flower.slug);
    const result = await addPlanting(farmId, {
      flowerSlug: item.flower.slug,
      variety: item.window.variety,
      method: item.window.method,
      nurseryStart: item.window.nurseryStart,
      fieldDate: item.window.fieldDate,
      bloomStart: item.window.bloomStart,
      bloomEnd: item.window.bloomEnd,
      liftDate: item.window.liftDate,
      firstBloomYear: item.window.firstBloomYear,
      spansYears: item.window.spansYears,
    });
    setBusy(null);
    if ("error" in result && result.error) {
      setNote(result.error);
      return;
    }
    setNote(`${item.flower.commonName} is on the year plan.`);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4" data-testid="sow-now">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">What to sow or plant now</p>
          <h2 className="font-heading text-2xl">For this garden, this week</h2>
        </div>
        <p className="max-w-sm text-xs text-muted-foreground">
          From your frost dates and the RHS rating. A gamble for this climate stays in the crop library.
        </p>
      </div>
      {suggestions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing is due in the next few weeks. The year plan still has the later sowings.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {suggestions.map((item) => {
            const timing =
              item.daysFromToday === 0
                ? "Today"
                : item.daysFromToday > 0
                  ? `${formatDateShort(item.when)} · in ${item.daysFromToday} days`
                  : `${formatDateShort(item.when)} · ${Math.abs(item.daysFromToday)} days ago, still worth it`;
            const detail = `${item.action} · ${timing} · ${fitLabel(item.fit)}`;
            return (
              <li key={item.flower.slug}>
                {draggable && onDrop && onDragStart && onDragEnd ? (
                  <PlantingDragSurface
                    id={`sow:${item.flower.slug}`}
                    label={item.flower.commonName}
                    detail={detail}
                    testId={`sow-${item.flower.slug}`}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop}
                    onActivate={() => void add(item)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <span>
                      <span className="block text-sm font-medium">{item.flower.commonName}</span>
                      <span className="text-xs text-muted-foreground">{detail}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy === item.flower.slug}
                      onClick={() => void add(item)}
                      className="h-9 shrink-0 rounded-full bg-primary px-3 text-xs text-primary-foreground"
                    >
                      Add to the year
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {draggable ? <p className="mt-2 text-xs text-muted-foreground">Drag one onto a bed, or click it to add it without a bed yet.</p> : null}
      {note ? <p className="mt-2 text-sm">{note}</p> : null}
    </section>
  );
}
