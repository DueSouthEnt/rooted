"use server";

import { revalidatePath } from "next/cache";
import { addPlanting } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { clashOnBed, createSharedBed, linkExistingBeds, usesOnVegBeds } from "@/lib/shared-beds";
import type { ShareUse } from "@/lib/shared-space";

function refresh(farmId: string) {
  revalidatePath(`/flowers/farms/${farmId}/beds`);
  revalidatePath(`/flowers/farms/${farmId}/plan`);
  revalidatePath("/veg/plan");
  revalidatePath("/veg/farm");
}

export async function createSharedBedAction(formData: FormData): Promise<{ error?: string }> {
  const farmId = String(formData.get("farmId") ?? "");
  const lengthM = Number(formData.get("lengthM"));
  const widthM = Number(formData.get("widthM"));
  const result = await createSharedBed({
    farmId,
    name: String(formData.get("name") ?? ""),
    lengthM,
    widthM,
  });
  return result.error ? { error: result.error } : {};
}

export async function linkBedsAction(formData: FormData): Promise<{ error?: string }> {
  const farmId = String(formData.get("farmId") ?? "");
  const result = await linkExistingBeds({
    farmId,
    flowerBedId: String(formData.get("flowerBedId") ?? ""),
    vegBedId: String(formData.get("vegBedId") ?? ""),
  });
  return result.error ? { error: result.error } : {};
}

export async function addSharedFlowerAction(formData: FormData): Promise<{ error?: string }> {
  const farmId = String(formData.get("farmId") ?? "");
  const flowerBedId = String(formData.get("flowerBedId") ?? "");
  const lengthM = Number(formData.get("lengthM"));
  const fieldDate = String(formData.get("fieldDate") ?? "");
  const bloomEnd = String(formData.get("bloomEnd") ?? "");
  const supabase = await createClient();
  const { data: bed } = await supabase.from("beds").select("shared_bed_id, length_cm").eq("id", flowerBedId).maybeSingle();
  if (bed?.shared_bed_id) {
    const { data: shared } = await supabase.from("shared_beds").select("name, length_m").eq("id", bed.shared_bed_id).maybeSingle();
    const { data: veg } = await supabase.from("veg_beds").select("id").eq("shared_bed_id", bed.shared_bed_id).maybeSingle();
    if (shared && veg) {
      const uses = await usesOnVegBeds(supabase, farmId, [veg.id as string]);
      const current = uses.get(veg.id as string);
      const message = clashOnBed(shared.name as string, Number(shared.length_m), current?.uses ?? [], {
        id: "new-flower",
        kind: "flower",
        label: String(formData.get("flowerSlug") ?? "Flower"),
        start: fieldDate,
        end: bloomEnd,
        lengthM: lengthM > 0 ? lengthM : Number(shared.length_m),
      });
      if (message) return { error: message };
    }
  }
  const saved = await addPlanting(farmId, {
    flowerSlug: String(formData.get("flowerSlug") ?? ""),
    variety: "",
    method: "direct",
    nurseryStart: null,
    fieldDate,
    bloomStart: fieldDate,
    bloomEnd,
    liftDate: null,
    firstBloomYear: Number(fieldDate.slice(0, 4)) || new Date().getFullYear(),
    spansYears: false,
    bedId: flowerBedId,
    bedLengthM: lengthM > 0 ? lengthM : undefined,
    quiet: true,
  });
  if ("error" in saved && saved.error) return { error: saved.error };
  refresh(farmId);
  return {};
}

export async function addSharedVegAction(formData: FormData): Promise<{ error?: string }> {
  const farmId = String(formData.get("farmId") ?? "");
  const vegBedId = String(formData.get("vegBedId") ?? "");
  const cropId = String(formData.get("cropId") ?? "");
  const fieldDate = String(formData.get("fieldDate") ?? "");
  const lastHarvest = String(formData.get("lastHarvest") ?? "");
  const lengthM = Number(formData.get("lengthM"));
  if (!cropId) return { error: "Choose a vegetable." };
  if (!fieldDate || !lastHarvest || lastHarvest < fieldDate) return { error: "Harvest has to finish on or after the sowing date." };
  const supabase = await createClient();
  const { data: crop } = await supabase.from("veg_crops").select("id, name, yield_unit").eq("id", cropId).maybeSingle();
  if (!crop) return { error: "That vegetable isn't in the catalogue." };
  const uses = await usesOnVegBeds(supabase, farmId, [vegBedId]);
  const current = uses.get(vegBedId);
  const bedLength = current?.lengthM ?? lengthM;
  const proposed: ShareUse = {
    id: "new-veg",
    kind: "veg",
    label: crop.name as string,
    start: fieldDate,
    end: lastHarvest,
    lengthM: lengthM > 0 ? lengthM : bedLength,
  };
  if (current) {
    const message = clashOnBed(current.name, current.lengthM, current.uses, proposed);
    if (message) return { error: message };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const bedFeet = (lengthM > 0 ? lengthM : bedLength) * 3.280839895;
  const inserted = await supabase.from("veg_plantings").insert({
    id,
    farm_id: farmId,
    crop_id: cropId,
    season_year: Number(fieldDate.slice(0, 4)) || new Date().getFullYear(),
    planting_method: "direct_seeded",
    date_mode: "field_planting",
    anchor_date: fieldDate,
    field_planting_date: fieldDate,
    first_harvest_date: fieldDate,
    last_harvest_date: lastHarvest,
    bed_feet: bedFeet,
    predicted_yield: 0,
    yield_unit: (crop.yield_unit as string) || "kg",
    notes: "",
    created_at: now,
    updated_at: now,
  });
  if (inserted.error) return { error: "Couldn't save that vegetable planting." };
  const link = await supabase.from("veg_planting_beds").insert({ farm_id: farmId, planting_id: id, bed_id: vegBedId });
  if (link.error) return { error: "Couldn't put that planting on the bed." };
  refresh(farmId);
  return {};
}

export async function sharedClashForVegBed(input: {
  farmId: string;
  vegBedId: string;
  start: string;
  end: string;
  lengthM: number;
  label: string;
  ignoreId?: string;
}): Promise<string | null> {
  const supabase = await createClient();
  const uses = await usesOnVegBeds(supabase, input.farmId, [input.vegBedId]);
  const current = uses.get(input.vegBedId);
  if (!current) return null;
  const existing = input.ignoreId ? current.uses.filter((use) => use.id !== input.ignoreId) : current.uses;
  return clashOnBed(current.name, current.lengthM, existing, {
    id: "proposed",
    kind: "veg",
    label: input.label,
    start: input.start,
    end: input.end,
    lengthM: input.lengthM > 0 ? input.lengthM : current.lengthM,
  });
}
