"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCompanionAction, saveCompanionAction, saveRotationFamilyAction } from "@/app/veg/actions";
import { Button } from "@/components/veg/ui/button";
import { ROTATION_FAMILIES, type CompanionRule } from "@/lib/veg/advice";
import { ukCropName } from "@/lib/veg/crop-names";

export function CropCompanions({
  cropId,
  cropName,
  family,
  rules,
}: {
  cropId: string;
  cropName: string;
  family: string | null;
  rules: CompanionRule[];
}) {
  const router = useRouter();
  const name = ukCropName(cropName);
  const mine = rules.filter((rule) => {
    const crop = ukCropName(rule.cropName).toLowerCase();
    const other = rule.otherName === "*" ? "*" : ukCropName(rule.otherName).toLowerCase();
    const key = name.toLowerCase();
    return crop === key || other === key || (rule.otherName === "*" && (crop.includes("fennel") ? key.includes("fennel") : crop === key));
  });
  const [chosen, setChosen] = useState(family ?? "Leafy/other");
  const [other, setOther] = useState("");
  const [kind, setKind] = useState<"good" | "bad">("good");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function saveFamily() {
    const result = await saveRotationFamilyAction(cropId, chosen);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function add() {
    setError(null);
    const result = await saveCompanionAction({ cropName: name, otherName: other, kind, reason });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOther("");
    setReason("");
    router.refresh();
  }

  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-5" data-testid="crop-companions">
      <div>
        <h2 className="font-display text-2xl">Rotation family</h2>
        <p className="mt-1 text-sm text-muted-foreground">Used when a bed is asked to grow the same family again in a later season.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-lg border bg-card px-2 text-sm" aria-label="Rotation family" value={chosen} onChange={(event) => setChosen(event.target.value)}>
            {ROTATION_FAMILIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={() => void saveFamily()}>
            Save family
          </Button>
        </div>
      </div>
      <div>
        <h2 className="font-display text-2xl">Companions</h2>
        <p className="mt-1 text-sm text-muted-foreground">A note when this crop shares a bed, or the next bed, with another. Nothing is blocked.</p>
        <ul className="mt-3 grid gap-2">
          {mine.map((rule) => (
            <li key={rule.id} className="flex items-start justify-between gap-3 text-sm">
              <span>
                <span className={rule.kind === "bad" ? "text-warning-foreground" : "text-success-foreground"}>{rule.kind === "bad" ? "Avoid" : "Good with"}</span>{" "}
                {rule.otherName === "*" ? "almost everything" : ukCropName(rule.otherName)}. {rule.reason}
              </span>
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => void deleteCompanionAction(rule.id).then(() => router.refresh())}>
                Remove
              </button>
            </li>
          ))}
          {mine.length === 0 ? <li className="text-sm text-muted-foreground">No companion notes for {name} yet.</li> : null}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
          <input className="h-9 rounded-lg border bg-card px-2 text-sm" aria-label="Other crop" placeholder="Other crop" value={other} onChange={(event) => setOther(event.target.value)} />
          <select className="h-9 rounded-lg border bg-card px-2 text-sm" aria-label="Helps or hinders" value={kind} onChange={(event) => setKind(event.target.value as "good" | "bad")}>
            <option value="good">Good with</option>
            <option value="bad">Avoid</option>
          </select>
          <input className="h-9 rounded-lg border bg-card px-2 text-sm" aria-label="Reason" placeholder="One-line reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button type="button" size="sm" onClick={() => void add()}>
            Add note
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-warning-foreground">{error}</p> : null}
      </div>
    </section>
  );
}
