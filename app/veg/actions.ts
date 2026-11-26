"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  addBed,
  assignPlantingBeds,
  clearPlantingBeds,
  createCustomTaskType,
  createManualTask,
  createPlantings,
  deleteBed,
  deleteBlock,
  deleteCrop,
  deleteFarmArea,
  deleteManualTask,
  deletePlanting,
  deleteSuccession,
  saveBed,
  saveBlock,
  saveCrop,
  saveFarmArea,
  saveFrostSettings,
  saveMapBlock,
  rescheduleTask,
  updateTask,
  saveQuickPlanting,
  saveUserVariety,
  saveRotationYears,
  saveRotationFamily,
  saveCompanion,
  deleteCompanion,
  setTaskStatus,
  updatePlanting,
} from "@/lib/veg/mutations";
import { usingFarm } from "@/lib/veg/memory";

function refresh() {
  revalidatePath("/veg", "layout");
}

export async function setSeasonAction(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return;
  const jar = await cookies();
  jar.set("tilth_season", String(year), { path: "/", maxAge: 60 * 60 * 24 * 400 });
  refresh();
}

export async function saveBlockAction(input: unknown) {
  const result = await usingFarm(() => saveBlock(input));
  if (result.ok) refresh();
  return result;
}

export async function saveFarmAreaAction(input: { id?: string; name: string; outline: [number, number][] }) {
  const result = await usingFarm(() => saveFarmArea(input));
  if (result.ok) refresh();
  return result;
}

export async function deleteFarmAreaAction(id: string) {
  const result = await usingFarm(() => deleteFarmArea(id));
  if (result.ok) refresh();
  return result;
}

export async function saveMapBlockAction(input: {
  id?: string;
  farmAreaId: string | null;
  name: string;
  type: "open_field" | "greenhouse" | "high_tunnel";
  unit: "ft" | "m";
  bedLength: number;
  bedWidth: number;
  pathWidth: number;
  centerLat: number;
  centerLng: number;
  rotationDeg: number;
  spanLengthM: number;
  spanWidthM: number;
  bedCount?: number;
}) {
  const result = await usingFarm(() => saveMapBlock(input));
  if (result.ok) refresh();
  return result;
}

export async function deleteBlockAction(id: string) {
  const result = await usingFarm(() => deleteBlock(id));
  if (result.ok) refresh();
  return result;
}

export async function addBedAction(blockId: string) {
  const result = await usingFarm(() => addBed(blockId));
  if (result.ok) refresh();
  return result;
}

export async function saveBedAction(input: unknown) {
  const result = await usingFarm(() => saveBed(input));
  if (result.ok) refresh();
  return result;
}

export async function deleteBedAction(id: string) {
  const result = await usingFarm(() => deleteBed(id));
  if (result.ok) refresh();
  return result;
}

export async function saveCropAction(input: unknown) {
  const result = await usingFarm(() => saveCrop(input));
  if (result.ok) refresh();
  return result;
}

export async function deleteCropAction(id: string) {
  const result = await usingFarm(() => deleteCrop(id));
  if (result.ok) refresh();
  return result;
}

export async function createPlantingsAction(input: unknown) {
  const result = await usingFarm(() => createPlantings(input));
  if (result.ok) refresh();
  return result;
}

export async function updatePlantingAction(input: unknown) {
  const result = await usingFarm(() => updatePlanting(input));
  if (result.ok) refresh();
  return result;
}

export async function deletePlantingAction(id: string) {
  const result = await usingFarm(() => deletePlanting(id));
  if (result.ok) refresh();
  return result;
}

export async function deleteSuccessionAction(groupId: string) {
  const result = await usingFarm(() => deleteSuccession(groupId));
  if (result.ok) refresh();
  return result;
}

export async function createTaskTypeAction(name: string) {
  const result = await usingFarm(() => createCustomTaskType(name));
  if (result.ok) refresh();
  return result;
}

export async function createTaskAction(input: unknown) {
  const result = await usingFarm(() => createManualTask(input));
  if (result.ok) refresh();
  return result;
}

export async function setTaskStatusAction(id: string, status: "open" | "done") {
  const result = await usingFarm(() => setTaskStatus(id, status));
  if (result.ok) refresh();
  return result;
}

export async function saveDisplayUnitAction(unit: "m" | "ft") {
  if (unit !== "m" && unit !== "ft") return;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: farms } = await supabase.from("farms").select("id").eq("user_id", auth.user.id).order("created_at").limit(1);
    const farmId = farms?.[0]?.id;
    if (!farmId) return;
    await supabase.from("veg_farm_settings").upsert({ farm_id: farmId, display_unit: unit }, { onConflict: "farm_id" });
  } catch {
    // The lengths stay in metres either way. The browser keeps the preference if this column is not there yet.
  }
}

export async function saveFrostSettingsAction(input: {
  locationLabel: string;
  frostLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
  manualLastSpringFrost: string | null;
  manualFirstAutumnFrost: string | null;
  useManualFrost: boolean;
}) {
  const result = await usingFarm(() => saveFrostSettings(input));
  if (result.ok) refresh();
  return result;
}

export async function saveUserVarietyAction(input: {
  cropName: string;
  varietyName: string;
  supplier: string;
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  rowsPerBed: number;
  spacingCm: number;
  plantingMethod: "direct_seeded" | "transplanted";
}) {
  const result = await usingFarm(() => saveUserVariety(input));
  if (result.ok) refresh();
  return result;
}

export async function saveQuickPlantingAction(input: Parameters<typeof saveQuickPlanting>[0]) {
  const result = await usingFarm(() => saveQuickPlanting(input));
  if (result.ok) refresh();
  return result;
}

export async function assignPlantingBedsAction(plantingId: string, startBedId: string) {
  const result = await usingFarm(() => assignPlantingBeds(plantingId, startBedId));
  if (result.ok) refresh();
  return result;
}

export async function clearPlantingBedsAction(plantingId: string) {
  const result = await usingFarm(() => clearPlantingBeds(plantingId));
  if (result.ok) refresh();
  return result;
}

export async function saveRotationYearsAction(years: number) {
  const result = await usingFarm(() => saveRotationYears(years));
  if (result.ok) refresh();
  return result;
}

export async function saveRotationFamilyAction(cropId: string, family: string) {
  const result = await usingFarm(() => saveRotationFamily(cropId, family));
  if (result.ok) refresh();
  return result;
}

export async function saveCompanionAction(input: { cropName: string; otherName: string; kind: "good" | "bad"; reason: string }) {
  const result = await usingFarm(() => saveCompanion(input));
  if (result.ok) refresh();
  return result;
}

export async function deleteCompanionAction(id: string) {
  const result = await usingFarm(() => deleteCompanion(id));
  if (result.ok) refresh();
  return result;
}

export async function updateTaskAction(id: string, input: unknown) {
  const result = await usingFarm(() => updateTask(id, input));
  if (result.ok) revalidatePath("/veg", "layout");
  return result;
}

export async function rescheduleTaskAction(id: string, dueDate: string) {
  const result = await usingFarm(() => rescheduleTask(id, dueDate));
  if (result.ok) refresh();
  return result;
}

export async function deleteTaskAction(id: string) {
  const result = await usingFarm(() => deleteManualTask(id));
  if (result.ok) refresh();
  return result;
}
