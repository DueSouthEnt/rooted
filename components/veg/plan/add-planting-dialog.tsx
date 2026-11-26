"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { clearPlantingBedsAction, deletePlantingAction, saveQuickPlantingAction, saveUserVarietyAction } from "@/app/veg/actions";
import { RepeatFields, TaskTypeSelect, emptyRepeat, type RepeatDraft } from "@/components/veg/tasks/task-fields";
import { controlClass, Field } from "@/components/veg/field";
import { Button } from "@/components/veg/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/veg/ui/dialog";
import { Input } from "@/components/veg/ui/input";
import { Textarea } from "@/components/veg/ui/textarea";
import { addDaysISO, formatMedium } from "@/lib/veg/dates";
import { plantingFrostWarnings } from "@/lib/veg/frost";
import type { FrostContext } from "@/lib/veg/queries";
import { cropMatchesQuery, ukCropName } from "@/lib/veg/crop-names";
import { adviceForPlacement, type AdvicePlanting, type BedRef, type CompanionRule } from "@/lib/veg/advice";
import { AdviceList } from "@/components/veg/plan/advice-list";
import { composePlantingDates, plantCountPhrase, type HarvestWindowUnit } from "@/lib/veg/planting-form";
import { repeatIntervalDays } from "@/lib/veg/repeat";
import type { PlantingMethod } from "@/lib/veg/types";
import type { CropView, PlantingView, TaskView } from "@/lib/veg/views";

type TaskRow = { title: string; dueDate: string; taskType: string } & RepeatDraft;

function extraTaskRows(tasks: TaskView[], plantingId: string | undefined): TaskRow[] {
  if (!plantingId) return [];
  const groups = new Map<string, TaskView>();
  for (const task of tasks) {
    if (task.plantingId !== plantingId || task.taskKey) continue;
    const key = `${task.title}|${task.taskType}|${task.repeatEveryDays ?? ""}|${task.repeatUntil ?? ""}`;
    const existing = groups.get(key);
    if (!existing || task.dueDate < existing.dueDate) groups.set(key, task);
  }
  return [...groups.values()].map((task) => {
    const weeks = task.repeatEveryDays != null && task.repeatEveryDays % 7 === 0;
    return {
      title: task.title,
      dueDate: task.dueDate,
      taskType: task.taskType,
      repeat: Boolean(task.repeatEveryDays),
      every: task.repeatEveryDays ? (weeks ? task.repeatEveryDays / 7 : task.repeatEveryDays) : 1,
      unit: weeks ? "weeks" : "days",
      until: task.repeatUntil ?? "",
    };
  });
}

export function AddPlantingDialog({
  open,
  onOpenChange,
  crops,
  season,
  today,
  frost,
  defaultBedLengthM,
  editing = null,
  tasks = [],
  rules = [],
  spans = [],
  bedRefs = [],
  rotationYears = 3,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crops: CropView[];
  season: number;
  today: string;
  frost: FrostContext | null;
  defaultBedLengthM: number;
  editing?: PlantingView | null;
  tasks?: TaskView[];
  rules?: CompanionRule[];
  spans?: AdvicePlanting[];
  bedRefs?: BedRef[];
  rotationYears?: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(editing ? `${editing.cropName} ${editing.cultivar}` : "");
  const [cropId, setCropId] = useState<string | null>(editing?.cropId ?? null);
  const [creating, setCreating] = useState(false);
  const [custom, setCustom] = useState({
    cropName: "",
    varietyName: "",
    supplier: "",
    daysToMaturity: 60,
    daysInNursery: 28,
    harvestWindowDays: 21,
    rowsPerBed: 3,
    spacingCm: 15,
    plantingMethod: "direct_seeded" as PlantingMethod,
  });
  const [method, setMethod] = useState<PlantingMethod>(editing?.plantingMethod ?? "direct_seeded");
  const [nurserySow, setNurserySow] = useState(editing?.nurseryStartDate ?? today);
  const [daysInNursery, setDaysInNursery] = useState(editing?.daysInNursery || 28);
  const [fieldDate, setFieldDate] = useState(editing?.fieldPlantingDate ?? today);
  const [manualField, setManualField] = useState<string | null>(editing?.fieldPlantingDate ?? null);
  const [daysToMaturity, setDaysToMaturity] = useState(editing?.daysToMaturity ?? 60);
  const [manualFirst, setManualFirst] = useState<string | null>(editing?.firstHarvestDate ?? null);
  const [windowAmount, setWindowAmount] = useState(editing?.harvestWindowDays ?? 21);
  const [windowUnit, setWindowUnit] = useState<HarvestWindowUnit>("days");
  const [manualLast, setManualLast] = useState<string | null>(editing?.lastHarvestDate ?? null);
  const [bedCount, setBedCount] = useState(editing?.bedsNeeded ?? 1);
  const [rows, setRows] = useState(editing?.rowsPerBed ?? 3);
  const [spacingCm, setSpacingCm] = useState(editing?.inRowSpacingCm ?? 15);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [harvestAmount, setHarvestAmount] = useState(editing && editing.predictedYield > 0 ? String(editing.predictedYield) : "");
  const [revenue, setRevenue] = useState(editing?.expectedRevenue != null ? String(editing.expectedRevenue) : "");
  const [taskRows, setTaskRows] = useState<TaskRow[]>(() => extraTaskRows(tasks, editing?.id));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [customTypes, setCustomTypes] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<CropView | null>(null);
  const [busy, setBusy] = useState(false);

  const varieties = extra ? [extra, ...crops.filter((crop) => crop.id !== extra.id)] : crops;
  const selected = varieties.find((crop) => crop.id === cropId) ?? null;
  const matches = varieties
    .filter((crop) => {
      return cropMatchesQuery(crop.name, `${crop.cultivar} ${crop.supplier ?? ""}`, query);
    })
    .slice(0, 8);

  const dates = useMemo(() => {
    try {
      return composePlantingDates({
        method,
        nurserySowDate: nurserySow,
        daysInNursery,
        fieldDate,
        daysToMaturity,
        harvestWindow: windowAmount,
        harvestWindowUnit: windowUnit,
        manualFieldDate: manualField,
        manualFirstHarvest: manualFirst,
        manualLastHarvest: manualLast,
      });
    } catch {
      return null;
    }
  }, [method, nurserySow, daysInNursery, fieldDate, daysToMaturity, windowAmount, windowUnit, manualField, manualFirst, manualLast]);

  const assignedLengths = (editing?.beds ?? []).map((bed) => (bed.unit === "ft" ? bed.length * 0.3048 : bed.length));
  const bedLengthM = assignedLengths[0] || editing?.bedLengthM || defaultBedLengthM;
  const plantPhrase = plantCountPhrase(assignedLengths, rows, spacingCm, defaultBedLengthM);
  const warnings =
    dates && selected
      ? plantingFrostWarnings({
          tolerance: selected.frostTolerance,
          fieldPlantingDate: dates.fieldPlantingDate,
          lastHarvestDate: dates.lastHarvestDate,
          lastSpringFrost: frost?.lastSpringFrost ?? null,
          firstAutumnFrost: frost?.firstAutumnFrost ?? null,
        }).warnings
      : [];

  function choose(crop: CropView) {
    setCropId(crop.id);
    setCreating(false);
    setMethod(crop.plantingMethod);
    setDaysToMaturity(crop.daysToMaturity);
    setDaysInNursery(crop.daysInNursery || 28);
    setWindowAmount(crop.harvestWindowDays);
    setWindowUnit("days");
    setRows(crop.rowsPerBed);
    setSpacingCm(Math.round(crop.inRowSpacingIn * 2.54));
    setManualField(null);
    setManualFirst(null);
    setManualLast(null);
    setQuery(`${ukCropName(crop.name)} ${crop.cultivar}`);
  }

  async function createVariety() {
    setBusy(true);
    setError(null);
    const result = await saveUserVarietyAction(custom);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const made: CropView = {
      id: result.data.id,
      name: custom.cropName.trim(),
      cultivar: custom.varietyName.trim(),
      category: "Other",
      plantingMethod: custom.plantingMethod,
      daysToMaturity: custom.daysToMaturity,
      daysInNursery: custom.daysInNursery,
      harvestWindowDays: custom.harvestWindowDays,
      rowsPerBed: custom.rowsPerBed,
      inRowSpacingIn: custom.spacingCm / 2.54,
      yieldPer100BedFeet: 0,
      yieldUnit: "bunches",
      color: "#8C3B2A",
      notes: "",
      family: null,
      frostTolerance: null,
      minSoilTempC: null,
      supplier: custom.supplier || null,
      sourceName: "Added on this farm",
      sourceUrl: null,
      betweenRowCm: null,
      germinationTempMin: null,
      germinationTempMax: null,
      germinationDaysMin: null,
      germinationDaysMax: null,
      sowIndoorsStart: null,
      sowIndoorsEnd: null,
      sowOutdoorsStart: null,
      sowOutdoorsEnd: null,
      transplantStart: null,
      transplantEnd: null,
      hardinessNotes: null,
      yieldIsEstimate: true,
      dtmIsTypical: false,
      userCreated: true,
      rotationFamily: "Leafy/other",
    };
    setExtra(made);
    choose(made);
    router.refresh();
  }

  async function save() {
    if (!selected || !dates) {
      setError("Choose a variety first.");
      return;
    }
    setBusy(true);
    setError(null);
    let result;
    try {
      result = await saveQuickPlantingAction({
      seasonYear: season,
      cropId: selected.id,
      method,
      nurserySowDate: nurserySow,
      daysInNursery,
      fieldDate,
      daysToMaturity,
      harvestWindow: windowAmount,
      harvestWindowUnit: windowUnit,
      manualFieldDate: manualField,
      manualFirstHarvest: manualFirst,
      manualLastHarvest: manualLast,
      bedCount,
      bedLengthM,
      rowsPerBed: rows,
      spacingCm,
      expectedHarvest: harvestAmount.trim() ? Number(harvestAmount) : null,
      expectedRevenue: revenue.trim() ? Number(revenue) : null,
      notes,
      customTasks: taskRows.map((task) => ({
        title: task.title,
        dueDate: task.dueDate,
        taskType: task.taskType,
        repeatEveryDays: task.repeat ? repeatIntervalDays(task.every, task.unit) : null,
        repeatUntil: task.repeat ? task.until || dates.lastHarvestDate : null,
      })),
      id: editing?.id,
    });
    } catch {
      setBusy(false);
      setError("The planting was not saved. Check the dates and try again.");
      return;
    }
    setBusy(false);
    if (!result?.ok) {
      setError(result?.error ?? "The planting was not saved.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  async function unassign() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const result = await clearPlantingBedsAction(editing.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const result = await deletePlantingAction(editing.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  const bedNames = (editing?.beds ?? []).map((bed) => bed.label);
  const editNotices =
    editing && dates && selected
      ? adviceForPlacement({
          planting: {
            id: editing.id,
            cropName: selected.name,
            cultivar: selected.cultivar,
            rotationFamily: selected.rotationFamily,
            seasonYear: season,
            start: dates.fieldPlantingDate,
            end: dates.lastHarvestDate,
            bedIds: editing.beds.map((bed) => bed.id),
          },
          bedIds: editing.beds.map((bed) => bed.id),
          others: spans.filter((item) => item.id !== editing.id),
          beds: bedRefs,
          rules,
          rotationYears,
        })
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card" data-testid="add-planting-dialog">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit planting" : "Add a planting"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Change the dates or the variety. Beds it already sits on stay put if the new dates still fit."
              : `It goes on the ${season} plan without a bed. Place it from the year plan or the farm map.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-4 pb-4">
          <Field label="Variety">
            <Input
              data-testid="variety-search"
              value={query}
              placeholder="Search beetroot, tomato, garlic…"
              onChange={(event) => {
                setQuery(event.target.value);
                setCropId(null);
              }}
            />
          </Field>
          {query.trim() && !selected ? (
            <ul data-testid="variety-results" className="grid gap-1 rounded-lg border bg-card p-1">
              {matches.map((crop) => (
                <li key={crop.id}>
                  <button type="button" className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => choose(crop)}>
                    {ukCropName(crop.name)} · {crop.cultivar}
                    <span className="block text-xs text-muted-foreground">{crop.supplier ?? crop.category}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  data-testid="create-variety"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
                  onClick={() => setCreating(true)}
                >
                  Create your own variety
                </button>
              </li>
            </ul>
          ) : null}
          {creating ? (
            <div data-testid="custom-variety-form" className="grid gap-3 rounded-xl bg-muted/50 p-3">
              <p className="font-display text-lg leading-none">Your variety</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Crop">
                  <Input data-testid="custom-crop" value={custom.cropName} onChange={(event) => setCustom({ ...custom, cropName: event.target.value })} placeholder="Beetroot" />
                </Field>
                <Field label="Variety name">
                  <Input data-testid="custom-variety" value={custom.varietyName} onChange={(event) => setCustom({ ...custom, varietyName: event.target.value })} placeholder="Boltardy" />
                </Field>
                <Field label="Supplier (optional)">
                  <Input value={custom.supplier} onChange={(event) => setCustom({ ...custom, supplier: event.target.value })} />
                </Field>
                <Field label="Days to maturity">
                  <Input type="number" value={custom.daysToMaturity} onChange={(event) => setCustom({ ...custom, daysToMaturity: Number(event.target.value) })} />
                </Field>
                <Field label="Harvest window (days)">
                  <Input type="number" value={custom.harvestWindowDays} onChange={(event) => setCustom({ ...custom, harvestWindowDays: Number(event.target.value) })} />
                </Field>
                <Field label="In-row spacing (cm)">
                  <Input type="number" value={custom.spacingCm} onChange={(event) => setCustom({ ...custom, spacingCm: Number(event.target.value) })} />
                </Field>
              </div>
              <Button type="button" data-testid="save-variety" disabled={busy} onClick={() => void createVariety()}>
                Save variety
              </Button>
            </div>
          ) : null}
          {selected ? <p className="text-sm">Using {selected.name} · {selected.cultivar}</p> : null}

          <div className="flex gap-2">
            <Button type="button" data-testid="method-direct" variant={method === "direct_seeded" ? "default" : "outline"} onClick={() => { setMethod("direct_seeded"); setManualField(null); }}>
              Direct seed
            </Button>
            <Button type="button" data-testid="method-nursery" variant={method === "transplanted" ? "default" : "outline"} onClick={() => setMethod("transplanted")}>
              Nursery
            </Button>
          </div>

          {method === "transplanted" ? (
            <div data-testid="nursery-fields" className="grid gap-3 sm:grid-cols-2">
              <Field label="Nursery sow date">
                <Input type="date" value={nurserySow} onChange={(event) => { setNurserySow(event.target.value); setManualField(null); }} />
              </Field>
              <Field label="Days in the nursery" hint="This sets the transplant date. You can still change that date.">
                <Input type="number" value={daysInNursery} onChange={(event) => { setDaysInNursery(Number(event.target.value)); setManualField(null); }} />
              </Field>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={method === "transplanted" ? "Transplant into the field" : "Field sow date"}>
              <Input
                data-testid="field-date"
                type="date"
                value={dates?.fieldPlantingDate ?? fieldDate}
                onChange={(event) => {
                  setManualField(event.target.value);
                  if (method === "direct_seeded") setFieldDate(event.target.value);
                }}
              />
            </Field>
            <Field label={method === "transplanted" ? "Days to maturity from transplant" : "Days to maturity"}>
              <Input type="number" value={daysToMaturity} onChange={(event) => { setDaysToMaturity(Number(event.target.value)); setManualFirst(null); }} />
            </Field>
            <Field label="First harvest" hint={dates ? `Worked out as ${formatMedium(dates.computedFirstHarvest)}` : undefined}>
              <Input type="date" value={dates?.firstHarvestDate ?? ""} onChange={(event) => setManualFirst(event.target.value)} />
            </Field>
            <Field label="Harvest window">
              <div className="flex gap-2">
                <Input type="number" value={windowAmount} onChange={(event) => { setWindowAmount(Number(event.target.value)); setManualLast(null); }} />
                <select className={controlClass} value={windowUnit} onChange={(event) => { setWindowUnit(event.target.value as HarvestWindowUnit); setManualLast(null); }}>
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                </select>
              </div>
            </Field>
            <Field label="End of harvest">
              <Input type="date" value={dates?.lastHarvestDate ?? ""} onChange={(event) => setManualLast(event.target.value)} />
            </Field>
          </div>
          {warnings.length > 0 ? (
            <ul className="grid gap-1 rounded-lg bg-warning px-3 py-2 text-sm text-warning-foreground">
              {warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}
            </ul>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Number of beds">
              <Input type="number" min={1} value={bedCount} onChange={(event) => setBedCount(Number(event.target.value))} />
            </Field>
            <Field label="Rows per bed">
              <Input type="number" min={1} value={rows} onChange={(event) => setRows(Number(event.target.value))} />
            </Field>
            <Field label="In-row spacing (cm)">
              <Input type="number" step="0.5" value={spacingCm} onChange={(event) => setSpacingCm(Number(event.target.value))} />
            </Field>
          </div>
          <p className="text-base" data-testid="plant-count">{plantPhrase}</p>
          {editing ? (
            <p className="text-sm text-muted-foreground" data-testid="planting-beds">
              {bedNames.length ? `On ${bedNames.join(", ")}.` : "Not on a bed yet."}
              <AdviceList notices={editNotices} />
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Expected harvest (optional)">
              <Input value={harvestAmount} onChange={(event) => setHarvestAmount(event.target.value)} placeholder="Leave blank" />
            </Field>
            <Field label="Expected revenue £ (optional)">
              <Input value={revenue} onChange={(event) => setRevenue(event.target.value)} placeholder="Leave blank" />
            </Field>
          </div>

          <div className="grid gap-2">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Tasks</p>
            <ul className="text-sm text-muted-foreground">
              {method === "transplanted" ? <li>Sow in the nursery, pot on, then transplant.</li> : <li>Direct sow on the field date.</li>}
              <li>Start the harvest on {dates ? formatMedium(dates.firstHarvestDate) : "the first pick"}.</li>
            </ul>
            {taskRows.map((task, index) => (
              <div key={index} className="grid gap-2 rounded-xl border p-3">
                <div className="flex gap-2">
                  <Input value={task.title} placeholder="Task" onChange={(event) => setTaskRows(taskRows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} />
                  <Input type="date" value={task.dueDate} onChange={(event) => setTaskRows(taskRows.map((row, rowIndex) => rowIndex === index ? { ...row, dueDate: event.target.value } : row))} />
                  <Button type="button" variant="outline" size="icon" aria-label="Remove task" onClick={() => setTaskRows(taskRows.filter((_, rowIndex) => rowIndex !== index))}>
                    <Trash2 />
                  </Button>
                </div>
                <TaskTypeSelect
                  value={task.taskType}
                  custom={customTypes}
                  onChange={(taskType) => setTaskRows(taskRows.map((row, rowIndex) => rowIndex === index ? { ...row, taskType } : row))}
                  onCreated={(type) => setCustomTypes((current) => current.some((item) => item.id === type.id) ? current : [...current, type])}
                />
                <RepeatFields
                  value={task}
                  untilHint="Repeats run until this date, or until the end of harvest if you leave it on that day."
                  onChange={(next) => setTaskRows(taskRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...next } : row))}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setTaskRows([...taskRows, { title: "", dueDate: dates ? addDaysISO(dates.fieldPlantingDate, 7) : today, taskType: "weeding", ...emptyRepeat(dates?.lastHarvestDate ?? "") }])}
            >
              <Plus /> Add a task
            </Button>
          </div>
          <Field label="Notes">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          {error ? <p className="text-sm text-warning-foreground">{error}</p> : null}
          <Button type="button" data-testid="save-planting" disabled={busy} onClick={() => void save()}>
            Save planting
          </Button>
          {editing ? (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {bedNames.length > 0 ? (
                <Button type="button" variant="outline" data-testid="unassign-planting" disabled={busy} onClick={() => void unassign()}>
                  Unassign from bed
                </Button>
              ) : null}
              {confirmRemove ? (
                <div data-testid="remove-planting-confirm" className="flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2">
                  <p className="text-sm text-destructive">Remove this planting and its tasks?</p>
                  <Button type="button" variant="destructive" className="bg-[#8C3B2A] text-white hover:bg-[#6e2c1f]" data-testid="confirm-remove-planting" disabled={busy} onClick={() => void remove()}>
                    Remove planting
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmRemove(false)}>
                    Keep it
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="destructive" className="bg-[#8C3B2A] text-white hover:bg-[#6e2c1f]" data-testid="remove-planting" disabled={busy} onClick={() => setConfirmRemove(true)}>
                  Remove planting
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
