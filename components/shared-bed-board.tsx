"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Carrot, Flower2 } from "lucide-react";
import { addSharedFlowerAction, addSharedVegAction, createSharedBedAction, linkBedsAction } from "@/lib/shared-actions";
import type { SharedBedView, LinkChoice } from "@/lib/shared-beds";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

const inputClass = "h-9 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground";

export function SharedBedBoard({
  farmId,
  beds,
  flowerChoices,
  vegChoices,
  flowers,
  crops,
}: {
  farmId: string;
  beds: SharedBedView[];
  flowerChoices: LinkChoice[];
  vegChoices: LinkChoice[];
  flowers: LinkChoice[];
  crops: LinkChoice[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(form: FormData, action: (form: FormData) => Promise<{ error?: string }>) {
    setPending(true);
    setError(null);
    const result = await action(form);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-4" data-testid="shared-beds">
      <div>
        <h2 className="font-heading text-2xl">Shared beds</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One bed, one outline. Flowers and vegetables can both use it, as long as they fit the length on the days they share.
        </p>
      </div>
      {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {beds.map((bed) => (
        <article key={bed.id} data-testid="shared-bed" className="rounded-xl border border-border bg-card p-4">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-xl">{bed.name}</h3>
            <p className="text-sm text-muted-foreground">
              {bed.lengthM} m × {bed.widthM} m
            </p>
          </header>
          {bed.clashes.length > 0 ? (
            <ul data-testid="shared-clash" className="mt-3 grid gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {bed.clashes.map((clash) => (
                <li key={`${clash.start}-${clash.labels.join()}`}>
                  {bed.name} is {clash.bedLengthM} m long, and {clash.labels.join(" and ")} want {clash.usedM} m of it at the same time.
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Flower2 className="size-4" aria-hidden /> Flowers
              </p>
              <ul className="mt-2 grid gap-2">
                {bed.plantings.filter((planting) => planting.kind === "flower").length === 0 ? (
                  <li className="text-sm text-muted-foreground">Nothing in flower on this bed.</li>
                ) : null}
                {bed.plantings
                  .filter((planting) => planting.kind === "flower")
                  .map((planting) => (
                    <li key={planting.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <Flower2 className="size-3.5 shrink-0" aria-label="Flower" />
                        {planting.label}
                      </span>
                      <span className="mt-1 block text-muted-foreground">
                        {planting.start} to {planting.end} · {planting.lengthM} m
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Carrot className="size-4" aria-hidden /> Vegetables
              </p>
              <ul className="mt-2 grid gap-2">
                {bed.plantings.filter((planting) => planting.kind === "veg").length === 0 ? (
                  <li className="text-sm text-muted-foreground">Nothing in vegetable on this bed.</li>
                ) : null}
                {bed.plantings
                  .filter((planting) => planting.kind === "veg")
                  .map((planting) => (
                    <li key={planting.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <Carrot className="size-3.5 shrink-0" aria-label="Vegetable" />
                        {planting.label}
                      </span>
                      <span className="mt-1 block text-muted-foreground">
                        {planting.start} to {planting.end} · {planting.lengthM} m
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {bed.flowerBedId && flowers.length > 0 ? (
              <form
                className="grid gap-2 rounded-lg bg-muted/40 p-3"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void run(new FormData(event.currentTarget), addSharedFlowerAction);
                }}
              >
                <p className="text-sm font-medium">Add a flower</p>
                <input type="hidden" name="farmId" value={farmId} />
                <input type="hidden" name="flowerBedId" value={bed.flowerBedId} />
                <Field label="Flower">
                  <select name="flowerSlug" className={inputClass} defaultValue={flowers[0]?.id}>
                    {flowers.map((flower) => (
                      <option key={flower.id} value={flower.id}>
                        {flower.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="In the ground">
                    <input name="fieldDate" type="date" required className={inputClass} defaultValue="2026-04-01" />
                  </Field>
                  <Field label="Last cut">
                    <input name="bloomEnd" type="date" required className={inputClass} defaultValue="2026-07-15" />
                  </Field>
                  <Field label="Length (m)">
                    <input name="lengthM" type="number" min="0.3" step="0.1" required className={inputClass} defaultValue={Math.min(2, bed.lengthM)} />
                  </Field>
                </div>
                <button type="submit" disabled={pending} className="h-9 rounded-full bg-primary px-3 text-sm text-primary-foreground">
                  Plant it
                </button>
              </form>
            ) : null}
            {bed.vegBedId && crops.length > 0 ? (
              <form
                className="grid gap-2 rounded-lg bg-muted/40 p-3"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void run(new FormData(event.currentTarget), addSharedVegAction);
                }}
              >
                <p className="text-sm font-medium">Add a vegetable</p>
                <input type="hidden" name="farmId" value={farmId} />
                <input type="hidden" name="vegBedId" value={bed.vegBedId} />
                <Field label="Vegetable">
                  <select name="cropId" className={inputClass} defaultValue={crops[0]?.id}>
                    {crops.map((crop) => (
                      <option key={crop.id} value={crop.id}>
                        {crop.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Sow or plant">
                    <input name="fieldDate" type="date" required className={inputClass} defaultValue="2026-05-01" />
                  </Field>
                  <Field label="Last harvest">
                    <input name="lastHarvest" type="date" required className={inputClass} defaultValue="2026-07-31" />
                  </Field>
                  <Field label="Length (m)">
                    <input name="lengthM" type="number" min="0.3" step="0.1" required className={inputClass} defaultValue={Math.min(2, bed.lengthM)} />
                  </Field>
                </div>
                <button type="submit" disabled={pending} className="h-9 rounded-full bg-primary px-3 text-sm text-primary-foreground">
                  Plant it
                </button>
              </form>
            ) : null}
          </div>
        </article>
      ))}

      <form
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void run(new FormData(event.currentTarget), createSharedBedAction);
        }}
      >
        <input type="hidden" name="farmId" value={farmId} />
        <Field label="New shared bed">
          <input name="name" required placeholder="North strip" className={inputClass} />
        </Field>
        <Field label="Length (m)">
          <input name="lengthM" type="number" min="0.3" step="0.1" required defaultValue="4" className={inputClass} />
        </Field>
        <Field label="Width (m)">
          <input name="widthM" type="number" min="0.3" step="0.1" required defaultValue="1.2" className={inputClass} />
        </Field>
        <button type="submit" disabled={pending} className="h-9 rounded-full bg-primary px-4 text-sm text-primary-foreground">
          Create
        </button>
      </form>

      {flowerChoices.length > 0 && vegChoices.length > 0 ? (
        <form
          className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void run(new FormData(event.currentTarget), linkBedsAction);
          }}
        >
          <input type="hidden" name="farmId" value={farmId} />
          <Field label="Flower bed">
            <select name="flowerBedId" className={inputClass} defaultValue={flowerChoices[0]?.id}>
              {flowerChoices.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vegetable bed">
            <select name="vegBedId" className={inputClass} defaultValue={vegChoices[0]?.id}>
              {vegChoices.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.name}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" disabled={pending} className="h-9 rounded-full border border-border px-4 text-sm">
            Link them
          </button>
        </form>
      ) : null}
    </section>
  );
}
