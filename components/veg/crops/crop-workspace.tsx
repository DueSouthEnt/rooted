"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { deleteCropAction, saveCropAction } from "@/app/veg/actions";
import { controlClass, Field } from "@/components/veg/field";
import { PageHeader } from "@/components/veg/page-header";
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
import { cropMatchesQuery, ukCropName } from "@/lib/veg/crop-names";
import { CATEGORIES, METHOD_LABEL } from "@/lib/veg/labels";
import type { PlantingMethod } from "@/lib/veg/types";
import { formatNumber } from "@/lib/veg/units";
import { AddPlantingDialog } from "@/components/veg/plan/add-planting-dialog";
import type { FrostContext } from "@/lib/veg/queries";
import type { BlockView, CropView } from "@/lib/veg/views";

type Draft = {
  id?: string;
  name: string;
  cultivar: string;
  category: string;
  plantingMethod: PlantingMethod;
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  rowsPerBed: number;
  inRowSpacingIn: number;
  yieldPer100BedFeet: number;
  yieldUnit: string;
  color: string;
  notes: string;
  family: string;
  frostTolerance: string;
  supplier: string;
  userCreated?: boolean;
};

const SWATCHES = ["#c4622d", "#e2b15a", "#8c3b2a", "#d4536a", "#7a3b55", "#4e5c34", "#7dae4c", "#3e8f5a", "#c6b48a", "#5c463c"];

const BLANK: Draft = {
  name: "",
  cultivar: "",
  category: "Greens",
  plantingMethod: "direct_seeded",
  daysToMaturity: 45,
  daysInNursery: 0,
  harvestWindowDays: 14,
  rowsPerBed: 3,
  inRowSpacingIn: 6,
  yieldPer100BedFeet: 80,
  yieldUnit: "lbs",
  color: "#c4622d",
  notes: "",
  family: "",
  frostTolerance: "hardy",
  supplier: "",
};

export function CropWorkspace({
  crops,
  blocks = [],
  season = new Date().getUTCFullYear(),
  today = "",
  frostDates = null,
  standardBedLengthM = 15,
}: {
  crops: CropView[];
  blocks?: BlockView[];
  season?: number;
  today?: string;
  frostDates?: FrostContext | null;
  standardBedLengthM?: number;
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [family, setFamily] = useState("All");
  const [frost, setFrost] = useState("All");
  const [supplier, setSupplier] = useState("All");
  const [month, setMonth] = useState("All");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const categories = ["All", ...new Set(crops.map((crop) => crop.category))];
  const families = ["All", ...new Set(crops.map((crop) => crop.family).filter((value): value is string => Boolean(value)))];
  const suppliers = ["All", ...new Set(crops.map((crop) => crop.supplier).filter((value): value is string => Boolean(value)))];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const monthNumber = month === "All" ? null : Number(month);
    return crops.filter((crop) => {
      const matchesCategory = category === "All" || crop.category === category;
      const matchesFamily = family === "All" || crop.family === family;
      const matchesFrost = frost === "All" || crop.frostTolerance === frost;
      const matchesSupplier = supplier === "All" || crop.supplier === supplier;
      const windows = [
        [crop.sowIndoorsStart, crop.sowIndoorsEnd],
        [crop.sowOutdoorsStart, crop.sowOutdoorsEnd],
        [crop.transplantStart, crop.transplantEnd],
      ];
      const matchesMonth =
        monthNumber === null ||
        windows.some(([start, end]) => start && end && monthNumber >= start && monthNumber <= end);
      const matchesQuery =
        !needle ||
        cropMatchesQuery(crop.name, `${crop.cultivar} ${crop.category} ${crop.family ?? ""} ${crop.supplier ?? ""}`, needle);
      return matchesCategory && matchesFamily && matchesFrost && matchesSupplier && matchesMonth && matchesQuery;
    });
  }, [category, crops, family, frost, month, query, supplier]);

  const cropOptions = [...new Set([
    ...crops.map((crop) => ukCropName(crop.name)),
    "Swede", "Aubergine", "Broad bean", "Mangetout", "Sweetcorn", "Pumpkin", "Leek", "Potato",
    "Cabbage", "Parsnip", "Celery", "Asparagus", "Rhubarb", "Strawberry", "Pak choi", "Shallot",
    "Brussels sprout", "Cauliflower", "Turnip",
  ])].sort();

  function open(crop?: CropView) {
    setDraft(
      crop
        ? {
            id: crop.id,
            name: crop.name,
            cultivar: crop.cultivar,
            category: crop.category,
            plantingMethod: crop.plantingMethod,
            daysToMaturity: crop.daysToMaturity,
            daysInNursery: crop.daysInNursery,
            harvestWindowDays: crop.harvestWindowDays,
            rowsPerBed: crop.rowsPerBed,
            inRowSpacingIn: crop.inRowSpacingIn,
            yieldPer100BedFeet: crop.yieldPer100BedFeet,
            yieldUnit: crop.yieldUnit,
            color: crop.color,
            notes: crop.notes,
            family: crop.family ?? "",
            frostTolerance: crop.frostTolerance ?? "hardy",
            supplier: crop.supplier ?? "",
            userCreated: crop.userCreated,
          }
        : BLANK,
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Library"
        title="Crops and cultivars"
        description="Spacing, days to maturity, and yield per 100 bed-feet. The game plan copies these numbers when a planting is saved."
        actions={
          <>
            <Button type="button" variant="outline" data-testid="crops-add-planting" onClick={() => setAdding(true)}>
              Add planting
            </Button>
            <Button type="button" data-testid="add-variety" onClick={() => open()}>
              <Plus />
              Add variety
            </Button>
            <Button type="button" variant="outline" data-testid="add-crop" onClick={() => open()}>
              Add crop
            </Button>
          </>
        }
      />
      <AddPlantingDialog
        open={adding}
        onOpenChange={setAdding}
        crops={crops}
        season={season}
        today={today || new Date().toISOString().slice(0, 10)}
        frost={frostDates}
        defaultBedLengthM={standardBedLengthM}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search carrots, kale, basil…"
          className="sm:max-w-xs"
          aria-label="Search crops"
        />
        <div className="flex flex-wrap gap-2">
          <select className={controlClass} aria-label="Family" value={family} onChange={(event) => setFamily(event.target.value)}>
            {families.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className={controlClass} aria-label="Frost tolerance" value={frost} onChange={(event) => setFrost(event.target.value)}>
            <option value="All">All hardiness</option>
            <option value="tender">Tender</option>
            <option value="half_hardy">Half-hardy</option>
            <option value="hardy">Hardy</option>
          </select>
          <select className={controlClass} aria-label="Supplier" value={supplier} onChange={(event) => setSupplier(event.target.value)}>
            {suppliers.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className={controlClass} aria-label="Sowing month" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="All">Any sowing month</option>
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((name, index) => (
              <option key={name} value={String(index + 1)}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full px-3 py-1 text-xs ${category === item ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            <tr className="border-b">
              <th className="px-3 py-3 font-medium">Crop</th>
              <th className="px-3 py-3 font-medium">Method</th>
              <th className="px-3 py-3 font-medium">DTM</th>
              <th className="px-3 py-3 font-medium">Nursery</th>
              <th className="px-3 py-3 font-medium">Window</th>
              <th className="px-3 py-3 font-medium">Spacing</th>
              <th className="px-3 py-3 font-medium">Hardiness</th>
              <th className="px-3 py-3 font-medium">Yield / 100 ft</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-muted-foreground">
                  No cultivars match that search.
                </td>
              </tr>
            ) : (
              filtered.map((crop) => (
                <tr key={crop.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-3">
                    <Link href={`/veg/crops/${crop.id}`} className="flex items-center gap-2 text-left">
                      <span className="size-2.5 rounded-full" style={{ background: crop.color }} />
                      <span>
                        <span className="block font-medium">
                          {ukCropName(crop.name)}
                          {crop.userCreated ? (
                            <>
                              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">Yours</span>
                              <button type="button" className="ml-2 text-xs text-primary underline-offset-2 hover:underline" onClick={() => open(crop)}>
                                Edit
                              </button>
                            </>
                          ) : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {crop.cultivar} · {crop.family ?? crop.category}
                          {crop.supplier ? ` · ${crop.supplier}` : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">{METHOD_LABEL[crop.plantingMethod]}</td>
                  <td className="px-3 py-3 num">{crop.daysToMaturity}d</td>
                  <td className="px-3 py-3 num">{crop.plantingMethod === "transplanted" ? `${crop.daysInNursery}d` : "—"}</td>
                  <td className="px-3 py-3 num">{crop.harvestWindowDays}d</td>
                  <td className="px-3 py-3 num">
                    {crop.rowsPerBed} rows · {formatNumber(crop.inRowSpacingIn, 1)} in
                  </td>
                  <td className="px-3 py-3 capitalize">{crop.frostTolerance?.replace("_", "-") ?? "—"}</td>
                  <td className="px-3 py-3 num">
                    {formatNumber(crop.yieldPer100BedFeet, 0)} {crop.yieldUnit}
                    {crop.yieldIsEstimate ? <span className="block text-xs text-muted-foreground">estimate</span> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={draft !== null} onOpenChange={(openDialog) => !openDialog && setDraft(null)}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit cultivar" : "Add a cultivar"}</DialogTitle>
            <DialogDescription>
              Pick a crop you already grow, or add a new one, then name the variety. Days to maturity run from the field date to the first harvest.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const payload = draft;
                startTransition(async () => {
                  const result = await saveCropAction(payload);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(payload.id ? "Cultivar updated." : "Cultivar added.");
                  setDraft(null);
                });
              }}
            >
              <Field label="Crop">
                <select
                  className={controlClass}
                  data-testid="crop-picker"
                  value={draft.name && cropOptions.includes(ukCropName(draft.name)) ? ukCropName(draft.name) : "__new__"}
                  onChange={(event) => {
                    const name = event.target.value;
                    if (name === "__new__") {
                      setDraft({ ...draft, name: "" });
                      return;
                    }
                    const sibling = crops.find((crop) => ukCropName(crop.name) === name || crop.name === name);
                    setDraft({
                      ...draft,
                      name: sibling?.name ?? name,
                      category: sibling?.category ?? draft.category,
                      family: sibling?.family ?? draft.family,
                      frostTolerance: sibling?.frostTolerance ?? draft.frostTolerance,
                      plantingMethod: sibling?.plantingMethod ?? draft.plantingMethod,
                      daysToMaturity: sibling?.daysToMaturity ?? draft.daysToMaturity,
                      rowsPerBed: sibling?.rowsPerBed ?? draft.rowsPerBed,
                    });
                  }}
                >
                  <option value="__new__">Add new crop</option>
                  {cropOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </Field>
              {!draft.name || !crops.some((crop) => ukCropName(crop.name) === ukCropName(draft.name)) ? (
                <div className="grid gap-3 sm:grid-cols-3" data-testid="new-crop-fields">
                  <Field label="New crop name">
                    <Input data-testid="new-crop-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
                  </Field>
                  <Field label="Family">
                    <Input value={draft.family} onChange={(event) => setDraft({ ...draft, family: event.target.value })} placeholder="Brassicaceae" />
                  </Field>
                  <Field label="Hardiness">
                    <select className={controlClass} value={draft.frostTolerance} onChange={(event) => setDraft({ ...draft, frostTolerance: event.target.value })}>
                      <option value="tender">Tender</option>
                      <option value="half_hardy">Half-hardy</option>
                      <option value="hardy">Hardy</option>
                    </select>
                  </Field>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Variety">
                  <Input data-testid="variety-name" value={draft.cultivar} onChange={(event) => setDraft({ ...draft, cultivar: event.target.value })} required />
                </Field>
                <Field label="Supplier">
                  <Input value={draft.supplier} onChange={(event) => setDraft({ ...draft, supplier: event.target.value })} />
                </Field>
                <Field label="Category">
                  <Input list="crop-categories" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required />
                  <datalist id="crop-categories">
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Planting method">
                  <select
                    className={controlClass}
                    value={draft.plantingMethod}
                    onChange={(event) => setDraft({ ...draft, plantingMethod: event.target.value as PlantingMethod })}
                  >
                    <option value="direct_seeded">Direct seeded</option>
                    <option value="transplanted">Transplanted</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Days to maturity">
                  <Input type="number" min={1} className="num" value={draft.daysToMaturity} onChange={(event) => setDraft({ ...draft, daysToMaturity: Number(event.target.value) })} />
                </Field>
                <Field label="Days in nursery">
                  <Input type="number" min={0} className="num" value={draft.daysInNursery} disabled={draft.plantingMethod === "direct_seeded"} onChange={(event) => setDraft({ ...draft, daysInNursery: Number(event.target.value) })} />
                </Field>
                <Field label="Harvest window">
                  <Input type="number" min={1} className="num" value={draft.harvestWindowDays} onChange={(event) => setDraft({ ...draft, harvestWindowDays: Number(event.target.value) })} />
                </Field>
                <Field label="Rows per bed">
                  <Input type="number" min={1} className="num" value={draft.rowsPerBed} onChange={(event) => setDraft({ ...draft, rowsPerBed: Number(event.target.value) })} />
                </Field>
                <Field label="In-row spacing (in)">
                  <Input type="number" min={0} step="0.1" className="num" value={draft.inRowSpacingIn} onChange={(event) => setDraft({ ...draft, inRowSpacingIn: Number(event.target.value) })} />
                </Field>
                <Field label="Yield / 100 bed-ft">
                  <Input type="number" min={0} step="0.1" className="num" value={draft.yieldPer100BedFeet} onChange={(event) => setDraft({ ...draft, yieldPer100BedFeet: Number(event.target.value) })} />
                </Field>
                <Field label="Yield unit">
                  <Input value={draft.yieldUnit} onChange={(event) => setDraft({ ...draft, yieldUnit: event.target.value })} />
                </Field>
                <Field label="Colour">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SWATCHES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={color}
                        className={`size-6 rounded-full ring-offset-2 ${draft.color === color ? "ring-2 ring-primary" : ""}`}
                        style={{ background: color }}
                        onClick={() => setDraft({ ...draft, color })}
                      />
                    ))}
                    <Input className="w-24 num" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
                  </div>
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
              </Field>
              <DialogFooter>
                {draft.id && draft.userCreated ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      const id = draft.id;
                      if (!id) return;
                      if (!window.confirm("Remove this cultivar from the library?")) return;
                      startTransition(async () => {
                        const result = await deleteCropAction(id);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Cultivar removed.");
                        setDraft(null);
                      });
                    }}
                  >
                    Delete
                  </Button>
                ) : null}
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save cultivar"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
