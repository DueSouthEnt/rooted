import { notFound, redirect } from "next/navigation";
import { flowers as bundledFlowers } from "@/data/flowers";
import type { Flower } from "@/lib/flower";
import { planningWindow, type Hemisphere, type Summer } from "@/lib/climate";
import type { RhsRating } from "@/lib/hardiness";
import { isRhsRating } from "@/lib/hardiness";
import type { BedRectangle, FarmBoundary, LngLat } from "@/lib/geo";
import type { SitePlan } from "@/lib/tasks";
import { createClient } from "@/lib/supabase/server";

export interface FarmRecord {
  id: string;
  user_id: string;
  name: string;
  season_year: number;
  place_name: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  hemisphere: Hemisphere | null;
  frost_free: boolean;
  occasional_frost: boolean;
  last_spring_month: number | null;
  last_spring_day: number | null;
  first_autumn_month: number | null;
  first_autumn_day: number | null;
  season_length_days: number | null;
  usda_zone: string | null;
  rhs_rating: string | null;
  summer: Summer | null;
  winter_min_c: number | null;
  tropical: boolean;
  frost_source: string | null;
  frost_note: string | null;
  plan_top: "north" | "east" | "south" | "west";
  boundary: FarmBoundary | null;
}

export interface CropRecord {
  id: string;
  flower_slug: string;
  status: "planting" | "established";
  successions: number;
}

export interface BedRecord {
  id: string;
  name: string;
  length_cm: number;
  width_cm: number;
  bed_kind: "annual" | "perennial" | "bulb";
  position_x: number;
  position_y: number;
  geometry: BedRectangle | null;
  block_id: string | null;
  block_index: number | null;
}

export interface BlockRecord {
  id: string;
  farm_id: string;
  area_name: string;
  name: string;
  bed_length_m: number;
  bed_width_cm: number;
  path_width_cm: number;
  bed_count: number;
  rotation_deg: number;
  origin: LngLat;
  along_sign: number;
  across_sign: number;
  season_year: number | null;
}

export interface BedPlantRecord {
  id: string;
  bed_id: string;
  flower_slug: string;
}

export interface TaskRecord {
  id: string;
  task_key: string;
  flower_slug: string | null;
  title: string;
  detail: string | null;
  due_date: string;
  category: string;
  completed_at: string | null;
  season_year: number;
}

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function loadProfile() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("display_name, units").eq("id", user.id).maybeSingle();
  return {
    supabase,
    user,
    displayName: data?.display_name || user.email?.split("@")[0] || "there",
    units: data?.units === "imperial" ? "imperial" : "metric",
  } as const;
}

export async function loadFlowers(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.from("flowers").select("data");
  if (error || !data?.length) {
    return { flowers: bundledFlowers, source: "bundled" as const };
  }
  const parsed = data
    .map((row) => row.data as Flower)
    .filter((flower) => flower && typeof flower.slug === "string");
  if (parsed.length < 50) return { flowers: bundledFlowers, source: "bundled" as const };
  return {
    flowers: parsed.sort((a, b) => a.commonName.localeCompare(b.commonName, "en-GB")),
    source: "database" as const,
  };
}

export function farmToSite(farm: FarmRecord): SitePlan | null {
  if (!farm.hemisphere || !farm.season_year) return null;
  const rhs = farm.rhs_rating && isRhsRating(farm.rhs_rating) ? (farm.rhs_rating as RhsRating) : null;
  const summer: Summer = farm.summer ?? "mild";
  const window = planningWindow(
    {
      hemisphere: farm.hemisphere,
      frostFree: farm.frost_free,
      lastSpringMonth: farm.last_spring_month,
      lastSpringDay: farm.last_spring_day,
      firstAutumnMonth: farm.first_autumn_month,
      firstAutumnDay: farm.first_autumn_day,
      seasonLengthDays: farm.season_length_days ?? 365,
    },
    farm.season_year,
  );
  return {
    seasonYear: farm.season_year,
    hemisphere: farm.hemisphere,
    frostFree: farm.frost_free,
    occasionalFrost: farm.occasional_frost,
    anchored: window.anchored,
    lastSpringFrost: window.lastSpringFrost,
    firstAutumnFrost: window.firstAutumnFrost,
    seasonLengthDays: farm.frost_free ? 365 : window.seasonLengthDays,
    usdaZone: farm.usda_zone,
    rhs,
    summer,
    tropical: farm.tropical,
  };
}

export async function loadFarm(farmId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("farms").select("*").eq("id", farmId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const farm = data as FarmRecord;
  const [{ data: crops }, { data: beds }, { data: plants }, { data: blocks }, catalogue] = await Promise.all([
    supabase.from("farm_crops").select("*").eq("farm_id", farmId),
    supabase.from("beds").select("*").eq("farm_id", farmId).order("block_index"),
    supabase.from("bed_plants").select("id, bed_id, flower_slug"),
    supabase.from("bed_blocks").select("*").eq("farm_id", farmId).order("name"),
    loadFlowers(supabase),
  ]);
  return {
    supabase,
    user,
    farm,
    crops: (crops ?? []) as CropRecord[],
    beds: (beds ?? []) as BedRecord[],
    blocks: (blocks ?? []) as BlockRecord[],
    plants: (plants ?? []) as BedPlantRecord[],
    flowers: catalogue.flowers,
    catalogueSource: catalogue.source,
    site: farmToSite(farm),
  };
}

export async function loadTasks(supabase: Awaited<ReturnType<typeof createClient>>, farmId: string, seasonYear: number) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("farm_id", farmId)
    .eq("season_year", seasonYear)
    .order("due_date");
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRecord[];
}
