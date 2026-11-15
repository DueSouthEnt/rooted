"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Flower } from "@/lib/flower";
import { isRhsRating } from "@/lib/hardiness";
import type { BedRectangle, FarmBoundary } from "@/lib/geo";
import { isBedRectangle, isFarmBoundary, toCentimetres } from "@/lib/geo";
import { loadFarm, loadProfile, requireUser, type FarmRecord } from "@/lib/records";
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
  const drafts = generateTasks(inputs, site);
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

export async function listFarms() {
  const { supabase, user, displayName, units } = await loadProfile();
  const { data, error } = await supabase.from("farms").select("*").order("created_at");
  if (error) {
    return { farms: [] as FarmRecord[], displayName, units, userEmail: user.email ?? "", error: error.message };
  }
  return { farms: (data ?? []) as FarmRecord[], displayName, units, userEmail: user.email ?? "", error: null };
}
