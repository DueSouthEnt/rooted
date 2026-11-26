"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SowNowCard } from "@/components/sow-now";
import { deletePlanting } from "@/lib/actions";
import { formatDateShort } from "@/lib/dates";
import type { PlantingDates, SowSuggestion } from "@/lib/schedule";

const METHOD: Record<string, string> = {
  indoor: "Under cover, then out",
  direct: "Sow direct",
  tuber: "Tuber",
  bulb: "Bulb",
  corm: "Corm",
  crown: "Crown",
  division: "Division",
};

export function GamePlan({
  farmId,
  plantings,
  suggestions,
  season,
  bedNames,
}: {
  farmId: string;
  plantings: PlantingDates[];
  suggestions: SowSuggestion[];
  season: number;
  bedNames: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Game plan · {season}</p>
        <h1 className="font-heading text-4xl">Every planting</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Add what the week suggests, then place each one on a bed in the year plan. The dates come from this farm’s frost dates.
        </p>
      </div>
      <SowNowCard farmId={farmId} suggestions={suggestions} />
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            <tr className="border-b">
              <th className="px-3 py-3 font-medium">Flower</th>
              <th className="px-3 py-3 font-medium">Variety</th>
              <th className="px-3 py-3 font-medium">Method</th>
              <th className="px-3 py-3 font-medium">Plant</th>
              <th className="px-3 py-3 font-medium">In flower</th>
              <th className="px-3 py-3 font-medium">Bed</th>
              <th className="px-3 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {plantings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-muted-foreground">
                  No plantings for {season} yet. The suggestions above are the ones that suit this week.
                </td>
              </tr>
            ) : (
              plantings.map((planting) => (
                <tr key={planting.id} className="border-b last:border-0">
                  <td className="px-3 py-3 font-medium">{planting.flowerName}</td>
                  <td className="px-3 py-3">{planting.variety}</td>
                  <td className="px-3 py-3">{METHOD[planting.method] ?? planting.method}</td>
                  <td className="px-3 py-3">{formatDateShort(planting.fieldDate)}</td>
                  <td className="px-3 py-3">
                    {planting.firstBloomYear > season ? `First bloom ${planting.firstBloomYear}` : `${formatDateShort(planting.bloomStart)} – ${formatDateShort(planting.bloomEnd)}`}
                  </td>
                  <td className="px-3 py-3">
                    {planting.bedId ? (
                      bedNames[planting.bedId] ?? "A bed"
                    ) : (
                      <Link href={`/flowers/farms/${farmId}/timeline?group=bed&place=${planting.id}`} className="underline">
                        Place on a bed
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm underline"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await deletePlanting(farmId, planting.id);
                          if ("error" in result && typeof result.error === "string") setNote(result.error);
                        });
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {note ? <p className="text-sm">{note}</p> : null}
    </div>
  );
}
