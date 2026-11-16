"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Flower } from "@/lib/flower";
import { isRhsRating } from "@/lib/hardiness";
import { packedSpanM, reflowBlock } from "@/lib/blocks";
import { assignedBeds, freeBedIds, groundSpan } from "@/lib/occupancy";
import { successionWindows } from "@/lib/succession";
import { isPlantingMethod, shiftDates, tasksForPlanting, type PlantingDates, type PlantingMethod } from "@/lib/schedule";
import type { BedRectangle, FarmBoundary, LngLat } from "@/lib/geo";
import { destination, isBedRectangle, isFarmBoundary, toCentimetres } from "@/lib/geo";
import { loadFarm, loadPlantings, loadProfile, requireUser, type FarmRecord, type PlantingRecord } from "@/lib/records";
import { farmToSite } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import { generateTasks } from "@/lib/tasks";

export interface ActionState {
  error?: string;
  message?: string;
}

function authError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already")) return "That email already has an account. Try logging in.";
  if (lower.includes("invalid") || lower.includes("credential")) {
    return "Email or password didn't match. Have another go.";
  }
  if (lower.includes("password")) return "Use at least 8 characters. A flower name is not a password.";
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed")) {
    return "Can't reach Supabase. If this is your machine, run `npx supabase start` and check .env.local.";
  }
  return "That didn't work. Check the details and try again.";
}

async function origin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://127.0.0.1:43123";
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!email.includes("@")) return { error: "That doesn't look like an email address." };
  if (password.length < 8) return { error: "Use at least 8 characters. Slugs are persistent; passwords should be too." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split("@")[0] },
      emailRedirectTo: `${await origin()}/auth/callback`,
    },
  });
  if (error) return { error: authError(error.message) };
  if (!data.session) {
    return { message: "Check your email and confirm the account, then log in. Local Supabase usually skips this step." };
  }
  redirect("/app");
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authError(error.message) };
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function intOrNull(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function climateFromForm(formData: FormData) {
  const hemisphere = formData.get("hemisphere") === "south" ? "south" : "north";
  const frostFree = formData.get("frostFree") === "true";
  const summerValue = String(formData.get("summer") ?? "mild");
  const summer = summerValue === "cool" || summerValue === "hot" ? summerValue : "mild";
  const rhs = String(formData.get("rhs") ?? "");
  const lastSpring = String(formData.get("lastSpring") ?? "");
  const firstAutumn = String(formData.get("firstAutumn") ?? "");
  const seasonYear = Number(String(formData.get("seasonYear") ?? lastSpring.slice(0, 4)));
  return {
    season_year: Number.isFinite(seasonYear) && seasonYear > 1900 ? seasonYear : new Date().getFullYear(),
    place_name: String(formData.get("placeName") ?? "").trim() || null,
    postal_code: String(formData.get("postalCode") ?? "").trim() || null,
    country: String(formData.get("country") ?? "").trim() || null,
    latitude: numberOrNull(formData.get("latitude")),
    longitude: numberOrNull(formData.get("longitude")),
    hemisphere,
    frost_free: frostFree,
    occasional_frost: formData.get("occasionalFrost") === "true",
    last_spring_month: frostFree ? null : monthOf(lastSpring),
    last_spring_day: frostFree ? null : dayOf(lastSpring),
    first_autumn_month: frostFree ? null : monthOf(firstAutumn),
    first_autumn_day: frostFree ? null : dayOf(firstAutumn),
    season_length_days: intOrNull(formData.get("seasonLength")),
    usda_zone: String(formData.get("usdaZone") ?? "").trim() || null,
    rhs_rating: isRhsRating(rhs) ? rhs : null,
    summer,
    winter_min_c: numberOrNull(formData.get("winterMinC")),
    tropical: formData.get("tropical") === "true",
    frost_source: String(formData.get("frostSource") ?? "manual"),
    frost_note: String(formData.get("frostNote") ?? "").trim() || null,
  };
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function monthOf(iso: string): number | null {
  const month = Number(iso.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

function dayOf(iso: string): number | null {
  const day = Number(iso.slice(8, 10));
  return day >= 1 && day <= 31 ? day : null;
}

export async function createFarm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the place a name. Home patch is a perfectly good one." };
  const climate = climateFromForm(formData);
  if (!climate.place_name && climate.latitude == null) {
    return { error: "Pick a place, or drop a pin. A frost date needs a somewhere." };
  }
  if (!climate.frost_free && (climate.last_spring_month == null || climate.first_autumn_month == null)) {
    return { error: "Add a last spring frost and a first autumn frost, or mark frost as rare." };
  }
  const { data, error } = await supabase
    .from("farms")
    .insert({ ...climate, user_id: user.id, name })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't save the farm. Is the database running?" };
  redirect(`/app/farms/${data.id}`);
}

export async function updateFarmClimate(farmId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const climate = climateFromForm(formData);
  const name = String(formData.get("name") ?? "").trim();
  if (!climate.frost_free && (climate.last_spring_month == null || climate.first_autumn_month == null)) {
    return { error: "Those frost dates aren't complete." };
  }
  const { error } = await supabase.from("farms").update({ ...climate, ...(name ? { name } : {}) }).eq("id", farmId);
  if (error) return { error: "Couldn't update the place." };
  revalidatePath(`/app/farms/${farmId}`);
  redirect(`/app/farms/${farmId}`);
}

export async function updateSeasonYear(farmId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const seasonYear = Number(formData.get("seasonYear"));
  if (!Number.isFinite(seasonYear) || seasonYear < 2000 || seasonYear > 2100) return;
  await supabase.from("farms").update({ season_year: seasonYear }).eq("id", farmId);
  revalidatePath(`/app/farms/${farmId}`);
}

export async function updatePlanTop(farmId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const planTop = String(formData.get("planTop"));
  if (!["north", "east", "south", "west"].includes(planTop)) return;
  await supabase.from("farms").update({ plan_top: planTop }).eq("id", farmId);
  revalidatePath(`/app/farms/${farmId}/beds`);
}

export async function deleteFarm(farmId: string) {
  const { supabase } = await requireUser();
  await supabase.from("farms").delete().eq("id", farmId);
  redirect("/app");
}

export async function updateUnits(formData: FormData) {
  const { supabase, user } = await requireUser();
  const units = formData.get("units") === "imperial" ? "imperial" : "metric";
  await supabase.from("profiles").update({ units }).eq("id", user.id);
  revalidatePath("/app");
}

async function refreshTasks(farmId: string) {
  const { supabase, farm, crops, flowers } = await loadFarm(farmId);
  const site = farmToSite(farm);
  if (!site) return;
  const bySlug = new Map(flowers.map((flower) => [flower.slug, flower]));
  const inputs = crops.flatMap((crop) => {
    const flower = bySlug.get(crop.flower_slug);
    if (!flower) return [];
    return [{ flower, status: crop.status, successions: crop.successions }];
  });
  const plantings = await loadPlantings(supabase, farmId);
  const fromPlantings = plantings.flatMap((row) => {
    const flower = bySlug.get(row.flower_slug);
    if (!flower) return [];
    return tasksForPlanting(asDates(row, flower.commonName, flower.colour)).map((task) => ({
      taskKey: task.taskKey,
      flowerSlug: task.flowerSlug,
      title: task.title,
      detail: task.detail,
      dueDate: task.dueDate,
      category: task.category,
      covered: task.category === "sow" && row.method === "indoor",
    }));
  });
  const drafts = [...generateTasks(inputs, site), ...fromPlantings];
  const { data: existing } = await supabase
    .from("tasks")
    .select("task_key, completed_at")
    .eq("farm_id", farmId)
    .eq("season_year", farm.season_year);
  const done = new Map((existing ?? []).map((row) => [row.task_key as string, row.completed_at as string | null]));
  await supabase.from("tasks").delete().eq("farm_id", farmId).eq("season_year", farm.season_year);
  if (drafts.length === 0) return;
  await supabase.from("tasks").insert(
    drafts.map((task) => ({
      farm_id: farmId,
      season_year: farm.season_year,
      task_key: task.taskKey,
      flower_slug: task.flowerSlug,
      title: task.title,
      detail: task.detail,
      due_date: task.dueDate,
      category: task.category,
      completed_at: done.get(task.taskKey) ?? null,
    })),
  );
}

export async function saveCrops(farmId: string, slugs: string[], mode: "add" | "remove") {
  const { supabase, flowers } = await loadFarm(farmId);
  const known = new Set(flowers.map((flower) => flower.slug));
  const clean = slugs.filter((slug) => known.has(slug));
  if (mode === "remove") {
    if (clean.length) {
      await supabase.from("farm_crops").delete().eq("farm_id", farmId).in("flower_slug", clean);
    }
  } else if (clean.length) {
    await supabase.from("farm_crops").upsert(
      clean.map((slug) => ({
        farm_id: farmId,
        flower_slug: slug,
        status: defaultStatus(flowers.find((flower) => flower.slug === slug)),
        successions: flowers.find((flower) => flower.slug === slug)?.defaultSuccessions ?? 1,
      })),
      { onConflict: "farm_id,flower_slug" },
    );
  }
  await refreshTasks(farmId);
  revalidatePath(`/app/farms/${farmId}`);
}

function defaultStatus(flower: Flower | undefined): "planting" | "established" {
  if (!flower) return "planting";
  return "planting";
}

export async function setCropStatus(farmId: string, slug: string, status: "planting" | "established") {
  const { supabase } = await requireUser();
  await supabase.from("farm_crops").update({ status }).eq("farm_id", farmId).eq("flower_slug", slug);
  await refreshTasks(farmId);
  revalidatePath(`/app/farms/${farmId}`);
}

export async function addBed(farmId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "New bed";
  const lengthCm = Number(formData.get("lengthCm"));
  const widthCm = Number(formData.get("widthCm"));
  const bedKind = String(formData.get("bedKind") ?? "annual");
  if (!Number.isFinite(lengthCm) || !Number.isFinite(widthCm) || lengthCm < 30 || widthCm < 30) {
    return { error: "A bed needs a length and a width. 30 cm is the smallest we'll pretend is a bed." };
  }
  const kind = bedKind === "perennial" || bedKind === "bulb" ? bedKind : "annual";
  const { count } = await supabase.from("beds").select("id", { count: "exact", head: true }).eq("farm_id", farmId);
  const { error } = await supabase.from("beds").insert({
    farm_id: farmId,
    name,
    length_cm: Math.round(lengthCm),
    width_cm: Math.round(widthCm),
    bed_kind: kind,
    position_y: (count ?? 0) * 2,
  });
  if (error) return { error: "Couldn't add that bed." };
  revalidatePath(`/app/farms/${farmId}/beds`);
  revalidatePath(`/app/farms/${farmId}/map`);
  return { message: "Bed added." };
}

export async function saveFarmBoundary(farmId: string, boundary: FarmBoundary | null) {
  const { supabase } = await requireUser();
  if (boundary && !isFarmBoundary(boundary)) {
    return { error: "That outline needs at least three corners." };
  }
  const { error } = await supabase.from("farms").update({ boundary }).eq("id", farmId);
  if (error) return { error: "Couldn't save the farm outline." };
  revalidatePath(`/app/farms/${farmId}/map`);
  return { ok: true };
}

export async function saveMappedBed(
  farmId: string,
  input: { name: string; bedKind: string; geometry: BedRectangle },
) {
  const { supabase } = await requireUser();
  if (!isBedRectangle(input.geometry)) return { error: "That shape isn't a bed yet." };
  const { lengthCm, widthCm } = toCentimetres(input.geometry);
  if (lengthCm < 40 || widthCm < 40 || lengthCm > 200000 || widthCm > 200000) {
    return { error: "Beds on the map need to be at least 40 cm on each side, and no longer than 2 km." };
  }
  const kind = input.bedKind === "perennial" || input.bedKind === "bulb" ? input.bedKind : "annual";
  const name = input.name.trim() || "Bed";
  const { count } = await supabase.from("beds").select("id", { count: "exact", head: true }).eq("farm_id", farmId);
  const { data, error } = await supabase
    .from("beds")
    .insert({
      farm_id: farmId,
      name,
      length_cm: lengthCm,
      width_cm: widthCm,
      bed_kind: kind,
      geometry: input.geometry,
      position_y: (count ?? 0) * 2,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't save that bed." };
  revalidatePath(`/app/farms/${farmId}/beds`);
  revalidatePath(`/app/farms/${farmId}/map`);
  return { id: data.id as string };
}

export async function updateMappedBed(
  farmId: string,
  bedId: string,
  geometry: BedRectangle,
) {
  const { supabase } = await requireUser();
  if (!isBedRectangle(geometry)) return { error: "That shape isn't a bed." };
  const { lengthCm, widthCm } = toCentimetres(geometry);
  const { error } = await supabase
    .from("beds")
    .update({ geometry, length_cm: lengthCm, width_cm: widthCm })
    .eq("id", bedId)
    .eq("farm_id", farmId);
  if (error) return { error: "Couldn't update that bed." };
  revalidatePath(`/app/farms/${farmId}/beds`);
  revalidatePath(`/app/farms/${farmId}/map`);
  return { ok: true };
}

export async function deleteBed(farmId: string, bedId: string) {
  const { supabase } = await requireUser();
  await supabase.from("beds").delete().eq("id", bedId).eq("farm_id", farmId);
  revalidatePath(`/app/farms/${farmId}/beds`);
  revalidatePath(`/app/farms/${farmId}/map`);
}

export async function assignFlower(farmId: string, bedId: string, slug: string) {
  const { supabase } = await requireUser();
  await supabase.from("bed_plants").upsert({ bed_id: bedId, flower_slug: slug }, { onConflict: "bed_id,flower_slug" });
  revalidatePath(`/app/farms/${farmId}/beds`);
  revalidatePath(`/app/farms/${farmId}/map`);
}

export async function unassignFlower(farmId: string, bedId: string, slug: string) {
  const { supabase } = await requireUser();
  await supabase.from("bed_plants").delete().eq("bed_id", bedId).eq("flower_slug", slug);
  revalidatePath(`/app/farms/${farmId}/beds`);
  revalidatePath(`/app/farms/${farmId}/map`);
}

export async function saveBedBlock(
  farmId: string,
  input: {
    name: string;
    areaName: string;
    bedLengthM: number;
    bedWidthCm: number;
    pathWidthCm: number;
    rotationDeg: number;
    origin: LngLat;
    alongSign: number;
    acrossSign: number;
    count: number;
    seasonYear: number;
  },
) {
  const { supabase } = await requireUser();
  if (input.count < 1 || input.count > 400) return { error: "A block needs between 1 and 400 beds." };
  const draft = reflowBlock({
    origin: input.origin,
    rotationDeg: input.rotationDeg,
    bedLengthM: input.bedLengthM,
    bedWidthM: input.bedWidthCm / 100,
    pathWidthM: input.pathWidthCm / 100,
    count: input.count,
    alongSign: input.alongSign,
    acrossSign: input.acrossSign,
  });
  const { data: block, error } = await supabase
    .from("bed_blocks")
    .insert({
      farm_id: farmId,
      area_name: input.areaName || "Farm area",
      name: input.name,
      bed_length_m: input.bedLengthM,
      bed_width_cm: input.bedWidthCm,
      path_width_cm: input.pathWidthCm,
      bed_count: input.count,
      rotation_deg: input.rotationDeg,
      origin: input.origin,
      along_sign: input.alongSign,
      across_sign: input.acrossSign,
      season_year: input.seasonYear,
    })
    .select("id")
    .single();
  if (error || !block) return { error: "Couldn't save that block." };
  const rows = draft.beds.map((geometry, index) => {
    const size = toCentimetres(geometry);
    return {
      farm_id: farmId,
      block_id: block.id as string,
      block_index: index + 1,
      name: `${input.name} ${index + 1}`,
      length_cm: size.lengthCm,
      width_cm: size.widthCm,
      bed_kind: "annual",
      geometry,
    };
  });
  const { error: bedError } = await supabase.from("beds").insert(rows);
  if (bedError) return { error: "The block was saved, but the beds didn't land. Try it again." };
  revalidatePath(`/app/farms/${farmId}/map`);
  revalidatePath(`/app/farms/${farmId}/beds`);
  return { id: block.id as string };
}

export async function updateBedBlock(
  farmId: string,
  blockId: string,
  patch: {
    name?: string;
    bedLengthM?: number;
    bedWidthCm?: number;
    pathWidthCm?: number;
    rotationDeg?: number;
    count?: number;
    seasonYear?: number | null;
  },
) {
  const { supabase } = await requireUser();
  const { data: existing, error } = await supabase.from("bed_blocks").select("*").eq("id", blockId).eq("farm_id", farmId).maybeSingle();
  if (error || !existing) return { error: "That block has gone missing." };
  const count = patch.count ?? existing.bed_count;
  const bedWidthCm = patch.bedWidthCm ?? existing.bed_width_cm;
  const pathWidthCm = patch.pathWidthCm ?? existing.path_width_cm;
  const bedLengthM = patch.bedLengthM ?? existing.bed_length_m;
  const rotationDeg = patch.rotationDeg ?? existing.rotation_deg;
  if (count < 1 || count > 400 || bedWidthCm < 20 || pathWidthCm < 0 || bedLengthM < 0.4) {
    return { error: "Those measurements won't make a bed. Width at least 20 cm, length at least 40 cm." };
  }
  const draft = reflowBlock({
    origin: existing.origin as LngLat,
    rotationDeg,
    bedLengthM,
    bedWidthM: bedWidthCm / 100,
    pathWidthM: pathWidthCm / 100,
    count,
    alongSign: existing.along_sign,
    acrossSign: existing.across_sign,
  });
  const { data: currentBeds } = await supabase
    .from("beds")
    .select("id, block_index")
    .eq("block_id", blockId)
    .order("block_index");
  const ordered = currentBeds ?? [];
  for (let index = 0; index < draft.beds.length; index += 1) {
    const geometry = draft.beds[index];
    const size = toCentimetres(geometry);
    const name = `${patch.name ?? existing.name} ${index + 1}`;
    const row = ordered[index];
    if (row) {
      await supabase
        .from("beds")
        .update({ geometry, length_cm: size.lengthCm, width_cm: size.widthCm, name, block_index: index + 1 })
        .eq("id", row.id);
    } else {
      await supabase.from("beds").insert({
        farm_id: farmId,
        block_id: blockId,
        block_index: index + 1,
        name,
        length_cm: size.lengthCm,
        width_cm: size.widthCm,
        bed_kind: "annual",
        geometry,
      });
    }
  }
  for (const extra of ordered.slice(draft.beds.length)) {
    await supabase.from("beds").delete().eq("id", extra.id);
  }
  await supabase
    .from("bed_blocks")
    .update({
      name: patch.name ?? existing.name,
      bed_length_m: bedLengthM,
      bed_width_cm: bedWidthCm,
      path_width_cm: pathWidthCm,
      bed_count: count,
      rotation_deg: rotationDeg,
      season_year: patch.seasonYear === undefined ? existing.season_year : patch.seasonYear,
    })
    .eq("id", blockId);
  revalidatePath(`/app/farms/${farmId}/map`);
  revalidatePath(`/app/farms/${farmId}/beds`);
  return { ok: true };
}

export async function deleteBedBlock(farmId: string, blockId: string) {
  const { supabase } = await requireUser();
  await supabase.from("bed_blocks").delete().eq("id", blockId).eq("farm_id", farmId);
  revalidatePath(`/app/farms/${farmId}/map`);
  revalidatePath(`/app/farms/${farmId}/beds`);
}

export async function duplicateBedBlock(farmId: string, blockId: string) {
  const { supabase } = await requireUser();
  const { data: block } = await supabase.from("bed_blocks").select("*").eq("id", blockId).eq("farm_id", farmId).maybeSingle();
  if (!block) return { error: "Nothing to copy." };
  const span = packedSpanM(block.bed_count, block.bed_width_cm / 100, block.path_width_cm / 100);
  const gap = span + block.path_width_cm / 100;
  const origin = block.origin as LngLat;
  const shifted = destination(origin[1], origin[0], block.rotation_deg + 90, block.across_sign * gap);
  const copy = await saveBedBlock(farmId, {
    name: `${block.name} copy`,
    areaName: block.area_name,
    bedLengthM: block.bed_length_m,
    bedWidthCm: block.bed_width_cm,
    pathWidthCm: block.path_width_cm,
    rotationDeg: block.rotation_deg,
    origin: shifted,
    alongSign: block.along_sign,
    acrossSign: block.across_sign,
    count: block.bed_count,
    seasonYear: block.season_year ?? new Date().getFullYear(),
  });
  return copy;
}

export async function rebuildCalendar(farmId: string) {
  await requireUser();
  await refreshTasks(farmId);
  revalidatePath(`/app/farms/${farmId}/week`);
}

export async function setTaskDone(farmId: string, taskId: string, done: boolean) {
  const { supabase } = await requireUser();
  await supabase
    .from("tasks")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("farm_id", farmId);
  revalidatePath(`/app/farms/${farmId}/week`);
}

function asDates(row: PlantingRecord, name: string, colour: string): PlantingDates {
  return {
    id: row.id,
    flowerSlug: row.flower_slug,
    flowerName: name,
    colour,
    variety: row.variety,
    method: isPlantingMethod(row.method) ? row.method : "direct",
    nurseryStart: row.nursery_start,
    fieldDate: row.field_date,
    bloomStart: row.bloom_start,
    bloomEnd: row.bloom_end,
    liftDate: row.lift_date,
    firstBloomYear: row.first_bloom_year,
    spansYears: row.spans_years,
    bedId: row.bed_id ?? row.planting_beds?.[0]?.bed_id ?? null,
    bedIds: row.planting_beds?.map((item) => item.bed_id).filter(Boolean).length
      ? row.planting_beds.map((item) => item.bed_id)
      : row.bed_id
        ? [row.bed_id]
        : [],
    bedsNeeded: row.beds_needed ?? 1,
    daysToMaturity: row.days_to_maturity ?? undefined,
    daysInNursery: row.days_in_nursery ?? undefined,
    bloomWeeks: row.bloom_weeks ?? undefined,
    spacingCm: row.spacing_cm ?? undefined,
    bedLengthM: row.bed_length_m ?? undefined,
    notes: row.notes ?? "",
    successionGroup: row.succession_group ?? null,
    successionIndex: row.succession_index ?? null,
  };
}

function occupiedEnd(planting: PlantingDates): string {
  const year = Number(planting.fieldDate.slice(0, 4));
  return groundSpan(planting, year)?.end ?? (planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd);
}

function revalidateFarm(farmId: string) {
  revalidatePath("/app");
  revalidatePath(`/app/farms/${farmId}`);
  revalidatePath(`/app/farms/${farmId}/timeline`);
  revalidatePath(`/app/farms/${farmId}/plan`);
  revalidatePath(`/app/farms/${farmId}/plants`);
  revalidatePath(`/app/farms/${farmId}/harvest`);
  revalidatePath(`/app/farms/${farmId}/week`);
  revalidatePath(`/app/farms/${farmId}/map`);
  revalidatePath(`/app/farms/${farmId}/beds`);
}

async function writeBeds(
  supabase: Awaited<ReturnType<typeof loadFarm>>["supabase"],
  plantingId: string,
  flowerSlug: string,
  previous: string[],
  next: string[],
  rows: PlantingRecord[],
): Promise<string | null> {
  const removed = await supabase.from("planting_beds").delete().eq("planting_id", plantingId);
  if (removed.error) return `Couldn't clear the old bed: ${removed.error.message}`;
  if (next.length) {
    const inserted = await supabase.from("planting_beds").insert(next.map((bedId) => ({ planting_id: plantingId, bed_id: bedId })));
    if (inserted.error) return `Couldn't put that on the bed: ${inserted.error.message}`;
  }
  const updated = await supabase.from("plantings").update({ bed_id: next[0] ?? null }).eq("id", plantingId);
  if (updated.error) return `Couldn't remember that bed: ${updated.error.message}`;
  for (const bedId of previous) {
    if (next.includes(bedId)) continue;
    const still = rows.some(
      (row) =>
        row.id !== plantingId &&
        row.flower_slug === flowerSlug &&
        (row.bed_id === bedId || row.planting_beds?.some((item) => item.bed_id === bedId)),
    );
    if (!still) {
      const cleared = await supabase.from("bed_plants").delete().eq("bed_id", bedId).eq("flower_slug", flowerSlug);
      if (cleared.error) return cleared.error.message;
    }
  }
  for (const bedId of next) {
    const planted = await supabase.from("bed_plants").upsert({ bed_id: bedId, flower_slug: flowerSlug }, { onConflict: "bed_id,flower_slug" });
    if (planted.error) return planted.error.message;
  }
  return null;
}

function finishPlantingQuietly(farmId: string) {
  after(() => {
    void refreshTasks(farmId);
  });
  revalidatePath(`/app/farms/${farmId}/week`);
  revalidatePath(`/app/farms/${farmId}/map`);
  revalidatePath(`/app/farms/${farmId}/plan`);
}

export async function addPlanting(
  farmId: string,
  input: {
    flowerSlug: string;
    variety: string;
    method: PlantingMethod;
    nurseryStart: string | null;
    fieldDate: string;
    bloomStart: string;
    bloomEnd: string;
    liftDate: string | null;
    firstBloomYear: number;
    spansYears: boolean;
    bedId?: string | null;
    bedIds?: string[];
    bedsNeeded?: number;
    daysToMaturity?: number;
    daysInNursery?: number;
    bloomWeeks?: number;
    spacingCm?: number;
    bedLengthM?: number;
    notes?: string;
    quiet?: boolean;
  },
) {
  const { supabase, flowers, farm, beds } = await loadFarm(farmId);
  const flower = flowers.find((item) => item.slug === input.flowerSlug);
  if (!flower) return { error: "That flower isn't in the catalogue." };
  if (!input.fieldDate || !input.bloomStart || !input.bloomEnd) return { error: "A planting needs a plant-out date and a bloom window." };
  const wanted = input.bedIds ?? (input.bedId ? [input.bedId] : []);
  if (wanted.some((bedId) => !beds.some((bed) => bed.id === bedId))) return { error: "That bed isn't on this farm." };
  const rows = await loadPlantings(supabase, farmId);
  const dated = rows.map((row) => asDates(row, flower.commonName, flower.colour));
  if (wanted.length) {
    const draft = { ...dated[0], id: "new", fieldDate: input.fieldDate, bloomEnd: input.bloomEnd, liftDate: input.liftDate, spansYears: input.spansYears, method: input.method, bedId: wanted[0], bedIds: wanted };
    const end = occupiedEnd({ ...draft, flowerName: flower.commonName, flowerSlug: flower.slug, colour: flower.colour, variety: input.variety, nurseryStart: input.nurseryStart, bloomStart: input.bloomStart, firstBloomYear: input.firstBloomYear });
    const free = freeBedIds(dated, wanted, input.fieldDate, end);
    if (wanted.some((bedId) => !free.includes(bedId))) return { error: "One of those beds is already planted for the whole time this would be in the ground." };
  }
  const { data, error } = await supabase
    .from("plantings")
    .insert({
      farm_id: farmId,
      flower_slug: flower.slug,
      variety: input.variety || flower.varieties.split(",")[0]?.trim() || "",
      method: input.method,
      nursery_start: input.nurseryStart,
      field_date: input.fieldDate,
      bloom_start: input.bloomStart,
      bloom_end: input.bloomEnd,
      lift_date: input.liftDate,
      first_bloom_year: input.firstBloomYear,
      spans_years: input.spansYears,
      bed_id: wanted[0] ?? null,
      beds_needed: input.bedsNeeded ?? 1,
      days_to_maturity: input.daysToMaturity ?? null,
      days_in_nursery: input.daysInNursery ?? null,
      bloom_weeks: input.bloomWeeks ?? null,
      spacing_cm: input.spacingCm ?? null,
      bed_length_m: input.bedLengthM ?? null,
      notes: input.notes ?? "",
      season_year: farm.season_year,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't save that planting." };
  const { data: already } = await supabase.from("farm_crops").select("id").eq("farm_id", farmId).eq("flower_slug", flower.slug).maybeSingle();
  if (!already) {
    await supabase.from("farm_crops").insert({
      farm_id: farmId,
      flower_slug: flower.slug,
      status: flower.yearsToEstablish > 1 ? "established" : "planting",
      successions: 1,
    });
  }
  if (wanted.length) {
    const placed = await writeBeds(supabase, data.id as string, flower.slug, [], wanted, rows);
    if (placed) return { error: placed };
  }
  if (input.quiet) finishPlantingQuietly(farmId);
  else {
    await refreshTasks(farmId);
    revalidateFarm(farmId);
  }
  return { id: data.id as string, bedIds: wanted };
}

export async function addSuccessionGroup(
  farmId: string,
  input: {
    flowerSlug: string;
    variety: string;
    method: PlantingMethod;
    nurseryStart: string | null;
    fieldDate: string;
    bloomStart: string;
    bloomEnd: string;
    liftDate: string | null;
    firstBloomYear: number;
    spansYears: boolean;
    bedsNeeded?: number;
    daysToMaturity?: number;
    daysInNursery?: number;
    bloomWeeks?: number;
    spacingCm?: number;
    bedLengthM?: number;
    notes?: string;
    count: number;
    intervalDays: number;
  },
) {
  const { supabase, flowers, farm } = await loadFarm(farmId);
  const flower = flowers.find((item) => item.slug === input.flowerSlug);
  if (!flower) return { error: "That flower isn't in the catalogue." };
  if (flower.lifeCycle !== "annual") return { error: "Only annuals are sown in succession. This one stays put." };
  const count = Math.max(1, Math.min(8, Math.round(input.count)));
  const group = crypto.randomUUID();
  const windows = successionWindows(
    {
      nurseryStart: input.nurseryStart,
      fieldDate: input.fieldDate,
      bloomStart: input.bloomStart,
      bloomEnd: input.bloomEnd,
      liftDate: input.liftDate,
      firstBloomYear: input.firstBloomYear,
    },
    count,
    input.intervalDays,
  );
  const rows = windows.map((window, index) => ({
    farm_id: farmId,
    flower_slug: flower.slug,
    variety: input.variety || flower.varieties.split(",")[0]?.trim() || "",
    method: input.method,
    nursery_start: window.nurseryStart,
    field_date: window.fieldDate,
    bloom_start: window.bloomStart,
    bloom_end: window.bloomEnd,
    lift_date: window.liftDate,
    first_bloom_year: window.firstBloomYear,
    spans_years: input.spansYears,
    beds_needed: input.bedsNeeded ?? 1,
    days_to_maturity: input.daysToMaturity ?? null,
    days_in_nursery: input.daysInNursery ?? null,
    bloom_weeks: input.bloomWeeks ?? null,
    spacing_cm: input.spacingCm ?? null,
    bed_length_m: input.bedLengthM ?? null,
    notes: input.notes ?? "",
    season_year: farm.season_year,
    succession_group: group,
    succession_index: index + 1,
  }));
  const { error } = await supabase.from("plantings").insert(rows);
  if (error) return { error: error.message };
  const { data: already } = await supabase.from("farm_crops").select("id").eq("farm_id", farmId).eq("flower_slug", flower.slug).maybeSingle();
  if (!already) {
    await supabase.from("farm_crops").insert({
      farm_id: farmId,
      flower_slug: flower.slug,
      status: "planting",
      successions: count,
    });
  }
  revalidateFarm(farmId);
  return { ok: true as const, group, count };
}

export async function assignMany(farmId: string, placements: { plantingId: string; bedIds: string[] }[]) {
  const { supabase, flowers, beds } = await loadFarm(farmId);
  const rows = await loadPlantings(supabase, farmId);
  const bySlug = new Map(flowers.map((flower) => [flower.slug, flower]));
  for (const placement of placements) {
    if (placement.bedIds.some((bedId) => !beds.some((bed) => bed.id === bedId))) return { error: "That bed isn't on this farm." };
    const row = rows.find((item) => item.id === placement.plantingId);
    if (!row) return { error: "One of those sowings has gone." };
    const flower = bySlug.get(row.flower_slug);
    const dated = rows.map((item) => asDates(item, flower?.commonName ?? item.flower_slug, flower?.colour ?? "#f7d5dc"));
    const current = dated.find((item) => item.id === placement.plantingId);
    if (!current) return { error: "One of those sowings has gone." };
    const free = freeBedIds(dated, placement.bedIds, current.fieldDate, occupiedEnd(current), placement.plantingId);
    if (placement.bedIds.some((bedId) => !free.includes(bedId))) {
      return { error: "A later sowing no longer fits that bed. It is still in the tray." };
    }
    const placed = await writeBeds(supabase, placement.plantingId, row.flower_slug, assignedBeds(current), placement.bedIds, rows);
    if (placed) return { error: placed };
    const updated = rows.find((item) => item.id === placement.plantingId);
    if (updated) {
      updated.bed_id = placement.bedIds[0] ?? null;
      updated.planting_beds = placement.bedIds.map((bedId) => ({ bed_id: bedId }));
    }
  }
  finishPlantingQuietly(farmId);
  return { ok: true as const };
}

export async function assignPlantingBeds(farmId: string, plantingId: string, bedIds: string[]) {
  const { supabase, flowers, beds } = await loadFarm(farmId);
  if (bedIds.some((bedId) => !beds.some((bed) => bed.id === bedId))) return { error: "That bed isn't on this farm." };
  const rows = await loadPlantings(supabase, farmId);
  const row = rows.find((item) => item.id === plantingId);
  if (!row) return { error: "That planting has gone." };
  const bySlug = new Map(flowers.map((flower) => [flower.slug, flower]));
  const dated = rows.map((item) => {
    const flower = bySlug.get(item.flower_slug);
    return asDates(item, flower?.commonName ?? item.flower_slug, flower?.colour ?? "#f7d5dc");
  });
  const current = dated.find((item) => item.id === plantingId)!;
  const free = freeBedIds(dated, bedIds, current.fieldDate, occupiedEnd(current), plantingId);
  if (bedIds.some((bedId) => !free.includes(bedId))) {
    return { error: "That bed is already planted for the whole time this one is in the ground." };
  }
  const placed = await writeBeds(supabase, plantingId, row.flower_slug, assignedBeds(current), bedIds, rows);
  if (placed) return { error: placed };
  finishPlantingQuietly(farmId);
  return { ok: true as const, bedIds };
}

export async function assignPlantingBed(farmId: string, plantingId: string, bedId: string) {
  return assignPlantingBeds(farmId, plantingId, [bedId]);
}

export async function clearPlantingBed(farmId: string, plantingId: string) {
  const { supabase } = await loadFarm(farmId);
  const rows = await loadPlantings(supabase, farmId);
  const row = rows.find((item) => item.id === plantingId);
  if (!row) return { error: "That planting has gone." };
  const previous = row.planting_beds?.map((item) => item.bed_id) ?? (row.bed_id ? [row.bed_id] : []);
  const cleared = await writeBeds(supabase, plantingId, row.flower_slug, previous, [], rows);
  if (cleared) return { error: cleared };
  await refreshTasks(farmId);
  revalidateFarm(farmId);
  return { ok: true as const };
}

export async function shiftPlanting(farmId: string, plantingId: string, days: number) {
  const { supabase, flowers } = await loadFarm(farmId);
  if (!Number.isFinite(days) || Math.abs(days) > 120) return { error: "Shift it by a season, not a lifetime." };
  const rows = await loadPlantings(supabase, farmId);
  const row = rows.find((item) => item.id === plantingId);
  if (!row) return { error: "That planting has gone." };
  const flower = flowers.find((item) => item.slug === row.flower_slug);
  const current = asDates(row, flower?.commonName ?? row.flower_slug, flower?.colour ?? "#f7d5dc");
  const moved = shiftDates(current, Math.round(days));
  const bedsHeld = assignedBeds(current);
  if (bedsHeld.length) {
    const dated = rows.map((item) => asDates(item, flower?.commonName ?? item.flower_slug, flower?.colour ?? "#f7d5dc"));
    const end = occupiedEnd(moved);
    const free = freeBedIds(dated, bedsHeld, moved.fieldDate, end, plantingId);
    if (bedsHeld.some((bedId) => !free.includes(bedId))) return { error: "That shift lands on a bed that is already planted." };
  }
  await supabase
    .from("plantings")
    .update({
      nursery_start: moved.nurseryStart,
      field_date: moved.fieldDate,
      bloom_start: moved.bloomStart,
      bloom_end: moved.bloomEnd,
      lift_date: moved.liftDate,
      first_bloom_year: moved.firstBloomYear,
    })
    .eq("id", plantingId)
    .eq("farm_id", farmId);
  await refreshTasks(farmId);
  revalidateFarm(farmId);
  return { ok: true as const };
}

export async function updatePlanting(
  farmId: string,
  plantingId: string,
  input: {
    variety: string;
    method: PlantingMethod;
    nurseryStart: string | null;
    fieldDate: string;
    bloomStart: string;
    bloomEnd: string;
    liftDate: string | null;
    firstBloomYear: number;
    spansYears: boolean;
    bedsNeeded?: number;
    daysToMaturity?: number;
    daysInNursery?: number;
    bloomWeeks?: number;
    spacingCm?: number;
    bedLengthM?: number;
    notes?: string;
  },
) {
  const { supabase, flowers } = await loadFarm(farmId);
  const rows = await loadPlantings(supabase, farmId);
  const row = rows.find((item) => item.id === plantingId);
  if (!row) return { error: "That planting has gone." };
  const flower = flowers.find((item) => item.slug === row.flower_slug);
  const dated = rows.map((item) => asDates(item, flower?.commonName ?? item.flower_slug, flower?.colour ?? "#f7d5dc"));
  const current = dated.find((item) => item.id === plantingId)!;
  const next = { ...current, ...input, bedId: current.bedId, bedIds: current.bedIds };
  const held = assignedBeds(current);
  if (held.length) {
    const end = occupiedEnd(next);
    const free = freeBedIds(dated, held, next.fieldDate, end, plantingId);
    if (held.some((bedId) => !free.includes(bedId))) {
      return { error: "Those dates clash with something already in that bed. Shorten the bloom, or take it off the bed first." };
    }
  }
  await supabase
    .from("plantings")
    .update({
      variety: input.variety,
      method: input.method,
      nursery_start: input.nurseryStart,
      field_date: input.fieldDate,
      bloom_start: input.bloomStart,
      bloom_end: input.bloomEnd,
      lift_date: input.liftDate,
      first_bloom_year: input.firstBloomYear,
      spans_years: input.spansYears,
      beds_needed: input.bedsNeeded ?? current.bedsNeeded ?? 1,
      days_to_maturity: input.daysToMaturity ?? null,
      days_in_nursery: input.daysInNursery ?? null,
      bloom_weeks: input.bloomWeeks ?? null,
      spacing_cm: input.spacingCm ?? null,
      bed_length_m: input.bedLengthM ?? null,
      notes: input.notes ?? "",
    })
    .eq("id", plantingId)
    .eq("farm_id", farmId);
  await refreshTasks(farmId);
  revalidateFarm(farmId);
  return { ok: true as const };
}

export async function deletePlanting(farmId: string, plantingId: string) {
  const { supabase } = await loadFarm(farmId);
  const rows = await loadPlantings(supabase, farmId);
  const row = rows.find((item) => item.id === plantingId);
  await supabase.from("plantings").delete().eq("id", plantingId).eq("farm_id", farmId);
  const previous = row?.planting_beds?.map((item) => item.bed_id) ?? (row?.bed_id ? [row.bed_id] : []);
  for (const bedId of previous) {
    const still = rows.some(
      (item) =>
        item.id !== plantingId &&
        item.flower_slug === row?.flower_slug &&
        (item.bed_id === bedId || item.planting_beds?.some((link) => link.bed_id === bedId)),
    );
    if (!still && row) await supabase.from("bed_plants").delete().eq("bed_id", bedId).eq("flower_slug", row.flower_slug);
  }
  await refreshTasks(farmId);
  revalidateFarm(farmId);
  return { ok: true as const };
}

export async function listFarms() {
  const { supabase, user, displayName, units } = await loadProfile();
  const { data, error } = await supabase.from("farms").select("*").order("created_at");
  if (error) {
    return { farms: [] as FarmRecord[], displayName, units, userEmail: user.email ?? "", error: error.message };
  }
  return { farms: (data ?? []) as FarmRecord[], displayName, units, userEmail: user.email ?? "", error: null };
}
