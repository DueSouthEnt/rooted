import { revalidatePath } from "next/cache";
import { flowers as bundledFlowers } from "@/data/flowers";
import { createClient } from "@/lib/supabase/server";
import type { BedRectangle } from "@/lib/geo";
import { layoutBeds, offsetLatLng, rotateMetres } from "@/lib/veg/bed-layout";
import { clashSentence, sharedClashes, type ShareClash, type ShareUse } from "@/lib/shared-space";

export type SharedPlanting = {
  id: string;
  kind: "flower" | "veg";
  label: string;
  start: string;
  end: string;
  lengthM: number;
};

export type SharedBedView = {
  id: string;
  name: string;
  lengthM: number;
  widthM: number;
  flowerBedId: string | null;
  vegBedId: string | null;
  plantings: SharedPlanting[];
  clashes: ShareClash[];
};

export type LinkChoice = { id: string; name: string };

const FEET_PER_METRE = 3.280839895;

function metresFromFeet(feet: number): number {
  return feet / FEET_PER_METRE;
}

function uniqueChoices(items: LinkChoice[]): LinkChoice[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

type FlowerRow = {
  id: string;
  flower_slug: string;
  variety: string;
  field_date: string;
  bloom_end: string;
  lift_date: string | null;
  bed_length_m: number | null;
  bed_id: string | null;
};

type VegRow = {
  id: string;
  crop_id: string;
  field_planting_date: string;
  last_harvest_date: string;
  bed_feet: number;
};

export async function loadSharedBoard(farmId: string): Promise<{
  beds: SharedBedView[];
  flowerChoices: LinkChoice[];
  vegChoices: LinkChoice[];
  flowers: LinkChoice[];
  crops: LinkChoice[];
} | null> {
  const supabase = await createClient();
  const { data: shared, error } = await supabase
    .from("shared_beds")
    .select("id, name, length_m, width_m")
    .eq("farm_id", farmId)
    .order("name");
  if (error) return null;

  const [{ data: flowerBeds }, { data: vegBeds }, { data: flowerPlantings }, { data: vegPlantings }, { data: links }, { data: crops }] =
    await Promise.all([
      supabase.from("beds").select("id, name, length_cm, shared_bed_id").eq("farm_id", farmId).order("name"),
      supabase.from("veg_beds").select("id, label, length, block_id, shared_bed_id").eq("farm_id", farmId),
      supabase
        .from("plantings")
        .select("id, flower_slug, variety, field_date, bloom_end, lift_date, bed_length_m, bed_id")
        .eq("farm_id", farmId),
      supabase.from("veg_plantings").select("id, crop_id, field_planting_date, last_harvest_date, bed_feet").eq("farm_id", farmId),
      supabase.from("veg_planting_beds").select("planting_id, bed_id").eq("farm_id", farmId),
      supabase.from("veg_crops").select("id, name, cultivar").is("farm_id", null).order("name").limit(12),
    ]);

  const [{ data: blocks }, { data: flowerNames }] = await Promise.all([
    supabase.from("veg_blocks").select("id, name").eq("farm_id", farmId),
      supabase.from("flowers").select("slug, common_name").order("common_name"),
  ]);

  const blockName = new Map((blocks ?? []).map((block) => [block.id as string, block.name as string]));
  const cropName = new Map(
    (crops ?? []).map((crop) => [crop.id as string, `${crop.name as string}${crop.cultivar ? ` · ${crop.cultivar as string}` : ""}`]),
  );
  const flowerName = new Map(bundledFlowers.map((flower) => [flower.slug, flower.commonName]));
  for (const flower of flowerNames ?? []) flowerName.set(flower.slug as string, flower.common_name as string);

  const flowerByShared = new Map<string, { id: string; lengthM: number }>();
  for (const bed of flowerBeds ?? []) {
    if (bed.shared_bed_id) flowerByShared.set(bed.shared_bed_id as string, { id: bed.id as string, lengthM: Number(bed.length_cm) / 100 });
  }
  const vegByShared = new Map<string, { id: string; lengthM: number; name: string }>();
  for (const bed of vegBeds ?? []) {
    if (!bed.shared_bed_id) continue;
    const block = blockName.get(bed.block_id as string) ?? "Bed";
    vegByShared.set(bed.shared_bed_id as string, {
      id: bed.id as string,
      lengthM: Number(bed.length),
      name: `${block} · ${bed.label as string}`,
    });
  }

  const vegBedsByPlanting = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = vegBedsByPlanting.get(link.planting_id as string) ?? [];
    list.push(link.bed_id as string);
    vegBedsByPlanting.set(link.planting_id as string, list);
  }

  const beds: SharedBedView[] = (shared ?? []).map((row) => {
    const flower = flowerByShared.get(row.id as string) ?? null;
    const veg = vegByShared.get(row.id as string) ?? null;
    const lengthM = Number(row.length_m);
    const plantings: SharedPlanting[] = [];
    for (const planting of (flowerPlantings ?? []) as FlowerRow[]) {
      const onBed = flower && (planting.bed_id === flower.id);
      if (!onBed) continue;
      const end = planting.lift_date && planting.lift_date > planting.bloom_end ? planting.lift_date : planting.bloom_end;
      const name = flowerName.get(planting.flower_slug) ?? planting.flower_slug;
      plantings.push({
        id: planting.id,
        kind: "flower",
        label: planting.variety ? `${name} · ${planting.variety}` : name,
        start: planting.field_date,
        end,
        lengthM: planting.bed_length_m && planting.bed_length_m > 0 ? Number(planting.bed_length_m) : lengthM,
      });
    }
    for (const planting of (vegPlantings ?? []) as VegRow[]) {
      const held = vegBedsByPlanting.get(planting.id) ?? [];
      if (!veg || !held.includes(veg.id)) continue;
      plantings.push({
        id: planting.id,
        kind: "veg",
        label: cropName.get(planting.crop_id) ?? "Vegetable",
        start: planting.field_planting_date,
        end: planting.last_harvest_date,
        lengthM: planting.bed_feet > 0 ? round1(metresFromFeet(Number(planting.bed_feet))) : lengthM,
      });
    }
    plantings.sort((a, b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label, "en-GB"));
    return {
      id: row.id as string,
      name: row.name as string,
      lengthM,
      widthM: Number(row.width_m),
      flowerBedId: flower?.id ?? null,
      vegBedId: veg?.id ?? null,
      plantings,
      clashes: sharedClashes(row.name as string, lengthM, plantings),
    };
  });

  return {
    beds,
    flowerChoices: (flowerBeds ?? [])
      .filter((bed) => !bed.shared_bed_id)
      .map((bed) => ({ id: bed.id as string, name: bed.name as string })),
    vegChoices: (vegBeds ?? [])
      .filter((bed) => !bed.shared_bed_id)
      .map((bed) => ({
        id: bed.id as string,
        name: `${blockName.get(bed.block_id as string) ?? "Bed"} · ${bed.label as string}`,
      })),
    flowers: uniqueChoices(
      (flowerNames ?? []).length
        ? (flowerNames ?? []).map((flower) => ({ id: flower.slug as string, name: flower.common_name as string }))
        : bundledFlowers.slice(0, 16).map((flower) => ({ id: flower.slug, name: flower.commonName })),
    ),
    crops: uniqueChoices(
      (crops ?? []).length
        ? (crops ?? []).map((crop) => ({
            id: crop.id as string,
            name: `${crop.name as string}${crop.cultivar ? ` · ${crop.cultivar as string}` : ""}`,
          }))
        : [
            { id: "tamar_beetroot_chioggia", name: "Beetroot · Chioggia" },
            { id: "tamar_lettuce_butterhead_may_queen", name: "Lettuce · May King" },
          ],
    ),
  };
}

function refresh(farmId: string) {
  revalidatePath(`/flowers/farms/${farmId}/beds`);
  revalidatePath(`/flowers/farms/${farmId}/map`);
  revalidatePath(`/flowers/farms/${farmId}/plan`);
  revalidatePath("/veg/plan");
  revalidatePath("/veg/farm");
}

type GeometrySource = {
  centerLng: number;
  centerLat: number;
  rotationDeg: number;
  lengthM: number;
  widthM: number;
};

function rectangleOf(source: GeometrySource): BedRectangle {
  return {
    type: "rectangle",
    center: [source.centerLng, source.centerLat],
    lengthM: source.lengthM,
    widthM: source.widthM,
    rotationDeg: source.rotationDeg,
  };
}

async function vegRectangle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vegBedId: string,
): Promise<GeometrySource | null> {
  const { data: bed } = await supabase.from("veg_beds").select("position, block_id").eq("id", vegBedId).maybeSingle();
  if (!bed) return null;
  const { data: block } = await supabase
    .from("veg_blocks")
    .select("center_lat, center_lng, rotation_deg, span_length_m, span_width_m, bed_length, bed_width, path_width, unit")
    .eq("id", bed.block_id)
    .maybeSingle();
  if (!block || block.center_lat == null || block.center_lng == null || block.span_length_m == null || block.span_width_m == null) {
    return null;
  }
  const layout = layoutBeds({
    spanLengthM: Number(block.span_length_m),
    spanWidthM: Number(block.span_width_m),
    bedLength: Number(block.bed_length),
    bedWidth: Number(block.bed_width),
    pathWidth: Number(block.path_width),
    unit: block.unit === "ft" ? "ft" : "m",
  });
  const laid = layout.beds[Number(bed.position)] ?? layout.beds[0];
  if (!laid) return null;
  const shifted = rotateMetres(laid.alongM, laid.acrossM, Number(block.rotation_deg ?? 0));
  const center = offsetLatLng(
    { latitude: Number(block.center_lat), longitude: Number(block.center_lng) },
    shifted.eastM,
    shifted.northM,
  );
  return {
    centerLng: center.longitude,
    centerLat: center.latitude,
    rotationDeg: Number(block.rotation_deg ?? 0),
    lengthM: laid.lengthM,
    widthM: laid.widthM,
  };
}

async function placeVegBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  farmId: string,
  name: string,
  geometry: GeometrySource,
): Promise<{ bedId: string } | { error: string }> {
  const blockId = crypto.randomUUID();
  const bedId = crypto.randomUUID();
  const now = new Date().toISOString();
  const block = await supabase.from("veg_blocks").insert({
    id: blockId,
    farm_id: farmId,
    name,
    type: "open_field",
    bed_length: geometry.lengthM,
    bed_width: geometry.widthM,
    path_width: 0,
    unit: "m",
    notes: "",
    sort_order: 0,
    center_lat: geometry.centerLat,
    center_lng: geometry.centerLng,
    rotation_deg: geometry.rotationDeg,
    span_length_m: geometry.lengthM,
    span_width_m: geometry.widthM,
    created_at: now,
    updated_at: now,
  });
  if (block.error) return { error: block.error.message };
  const bed = await supabase.from("veg_beds").insert({
    id: bedId,
    farm_id: farmId,
    block_id: blockId,
    label: "1",
    position: 0,
    length: geometry.lengthM,
    width: geometry.widthM,
    created_at: now,
    updated_at: now,
  });
  if (bed.error) return { error: bed.error.message };
  return { bedId };
}

async function writeFlowerGeometry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  flowerBedId: string,
  geometry: GeometrySource,
) {
  const shape = rectangleOf(geometry);
  await supabase
    .from("beds")
    .update({
      geometry: shape,
      length_cm: Math.round(geometry.lengthM * 100),
      width_cm: Math.round(geometry.widthM * 100),
    })
    .eq("id", flowerBedId);
}

export async function createSharedBed(input: {
  farmId: string;
  name: string;
  lengthM: number;
  widthM: number;
}): Promise<{ error?: string; id?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Name the bed." };
  if (!(input.lengthM > 0) || !(input.widthM > 0)) return { error: "Length and width need to be greater than zero." };
  const supabase = await createClient();
  const { data: farm } = await supabase.from("farms").select("latitude, longitude").eq("id", input.farmId).maybeSingle();
  const geometry: GeometrySource | null =
    farm?.latitude != null && farm?.longitude != null
      ? { centerLat: Number(farm.latitude), centerLng: Number(farm.longitude), rotationDeg: 0, lengthM: input.lengthM, widthM: input.widthM }
      : null;
  const { data: flower, error: flowerError } = await supabase
    .from("beds")
    .insert({
      farm_id: input.farmId,
      name,
      length_cm: Math.round(input.lengthM * 100),
      width_cm: Math.round(input.widthM * 100),
      bed_kind: "annual",
      geometry: geometry ? rectangleOf(geometry) : null,
    })
    .select("id")
    .single();
  if (flowerError || !flower) return { error: "Couldn't add the flower side of that bed." };

  let vegBedId: string | null = null;
  if (geometry) {
    const placed = await placeVegBlock(supabase, input.farmId, name, geometry);
    if ("error" in placed) return { error: "Couldn't add the vegetable side of that bed." };
    vegBedId = placed.bedId;
  } else {
    const blockId = crypto.randomUUID();
    const bedId = crypto.randomUUID();
    const now = new Date().toISOString();
    const block = await supabase.from("veg_blocks").insert({
      id: blockId,
      farm_id: input.farmId,
      name,
      type: "open_field",
      bed_length: input.lengthM,
      bed_width: input.widthM,
      path_width: 0,
      unit: "m",
      notes: "",
      sort_order: 0,
      created_at: now,
      updated_at: now,
    });
    if (block.error) return { error: "Couldn't add the vegetable side of that bed." };
    const bed = await supabase.from("veg_beds").insert({
      id: bedId,
      farm_id: input.farmId,
      block_id: blockId,
      label: "1",
      position: 0,
      length: input.lengthM,
      width: input.widthM,
      created_at: now,
      updated_at: now,
    });
    if (bed.error) return { error: "Couldn't add the vegetable side of that bed." };
    vegBedId = bedId;
  }

  const { data: shared, error: sharedError } = await supabase
    .from("shared_beds")
    .insert({
      farm_id: input.farmId,
      name,
      length_m: input.lengthM,
      width_m: input.widthM,
      center_lng: geometry?.centerLng ?? null,
      center_lat: geometry?.centerLat ?? null,
      rotation_deg: geometry?.rotationDeg ?? 0,
    })
    .select("id")
    .single();
  if (sharedError || !shared) return { error: "Couldn't save the shared bed." };
  await supabase.from("beds").update({ shared_bed_id: shared.id }).eq("id", flower.id);
  await supabase.from("veg_beds").update({ shared_bed_id: shared.id }).eq("id", vegBedId);
  refresh(input.farmId);
  return { id: shared.id as string };
}

export async function linkExistingBeds(input: {
  farmId: string;
  flowerBedId: string;
  vegBedId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const [{ data: flower }, { data: veg }] = await Promise.all([
    supabase.from("beds").select("id, name, length_cm, width_cm, geometry, shared_bed_id").eq("id", input.flowerBedId).eq("farm_id", input.farmId).maybeSingle(),
    supabase.from("veg_beds").select("id, length, width, shared_bed_id").eq("id", input.vegBedId).eq("farm_id", input.farmId).maybeSingle(),
  ]);
  if (!flower || !veg) return { error: "Choose a flower bed and a vegetable bed on this farm." };
  if (flower.shared_bed_id || veg.shared_bed_id) return { error: "One of those beds is already shared." };
  const fromVeg = await vegRectangle(supabase, input.vegBedId);
  const flowerGeometry = flower.geometry as BedRectangle | null;
  const geometry: GeometrySource | null = fromVeg
    ? fromVeg
    : flowerGeometry
      ? {
          centerLng: flowerGeometry.center[0],
          centerLat: flowerGeometry.center[1],
          rotationDeg: flowerGeometry.rotationDeg,
          lengthM: flowerGeometry.lengthM,
          widthM: flowerGeometry.widthM,
        }
      : null;
  const lengthM = geometry?.lengthM ?? Number(flower.length_cm) / 100;
  const widthM = geometry?.widthM ?? Number(flower.width_cm) / 100;
  const { data: shared, error } = await supabase
    .from("shared_beds")
    .insert({
      farm_id: input.farmId,
      name: flower.name as string,
      length_m: lengthM,
      width_m: widthM,
      center_lng: geometry?.centerLng ?? null,
      center_lat: geometry?.centerLat ?? null,
      rotation_deg: geometry?.rotationDeg ?? 0,
    })
    .select("id")
    .single();
  if (error || !shared) return { error: "Couldn't link those beds." };
  await supabase.from("beds").update({ shared_bed_id: shared.id }).eq("id", flower.id);
  await supabase.from("veg_beds").update({ shared_bed_id: shared.id }).eq("id", veg.id);
  if (geometry) await writeFlowerGeometry(supabase, flower.id as string, geometry);
  refresh(input.farmId);
  return {};
}

export async function usesOnVegBeds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  farmId: string,
  vegBedIds: string[],
): Promise<Map<string, { name: string; lengthM: number; uses: ShareUse[] }>> {
  const result = new Map<string, { name: string; lengthM: number; uses: ShareUse[] }>();
  if (vegBedIds.length === 0) return result;
  const { data: vegBeds } = await supabase.from("veg_beds").select("id, shared_bed_id, length, label").in("id", vegBedIds);
  const sharedIds = (vegBeds ?? []).map((bed) => bed.shared_bed_id).filter((id): id is string => Boolean(id));
  if (sharedIds.length === 0) return result;
  const { data: sharedRows } = await supabase.from("shared_beds").select("id, name, length_m").in("id", sharedIds);
  const { data: flowerBeds } = await supabase.from("beds").select("id, shared_bed_id").in("shared_bed_id", sharedIds);
  const flowerIds = (flowerBeds ?? []).map((bed) => bed.id as string);
  const [{ data: plantings }, { data: vegLinks }] = await Promise.all([
    flowerIds.length
      ? supabase.from("plantings").select("id, flower_slug, variety, field_date, bloom_end, lift_date, bed_length_m, bed_id").in("bed_id", flowerIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase.from("veg_planting_beds").select("planting_id, bed_id").in("bed_id", vegBedIds),
  ]);
  const vegPlantingIds = (vegLinks ?? []).map((link) => link.planting_id as string);
  const { data: vegRows } = vegPlantingIds.length
    ? await supabase.from("veg_plantings").select("id, crop_id, field_planting_date, last_harvest_date, bed_feet").in("id", vegPlantingIds)
    : { data: [] as Record<string, unknown>[] };
  const vegById = new Map((vegRows ?? []).map((row) => [row.id as string, row]));
  const sharedById = new Map((sharedRows ?? []).map((row) => [row.id as string, row]));
  for (const bed of vegBeds ?? []) {
    if (!bed.shared_bed_id) continue;
    const shared = sharedById.get(bed.shared_bed_id as string);
    if (!shared) continue;
    const flower = (flowerBeds ?? []).find((item) => item.shared_bed_id === bed.shared_bed_id);
    const lengthM = Number(shared.length_m);
    const uses: ShareUse[] = [];
    for (const planting of plantings ?? []) {
      if (!flower || planting.bed_id !== flower.id) continue;
      const end = planting.lift_date && planting.lift_date > planting.bloom_end ? planting.lift_date : planting.bloom_end;
      uses.push({
        id: planting.id as string,
        kind: "flower",
        label: (planting.variety as string) || (planting.flower_slug as string),
        start: planting.field_date as string,
        end: end as string,
        lengthM: planting.bed_length_m && Number(planting.bed_length_m) > 0 ? Number(planting.bed_length_m) : lengthM,
      });
    }
    for (const link of vegLinks ?? []) {
      if (link.bed_id !== bed.id) continue;
      const planting = vegById.get(link.planting_id as string);
      if (!planting) continue;
      uses.push({
        id: planting.id as string,
        kind: "veg",
        label: planting.crop_id as string,
        start: planting.field_planting_date as string,
        end: planting.last_harvest_date as string,
        lengthM: Number(planting.bed_feet) > 0 ? Number(planting.bed_feet) / 3.280839895 : lengthM,
      });
    }
    result.set(bed.id as string, { name: shared.name as string, lengthM, uses });
  }
  return result;
}

export async function followFlowerOutline(farmId: string, flowerBedId: string, geometry: BedRectangle) {
  const supabase = await createClient();
  const { data: bed } = await supabase.from("beds").select("shared_bed_id").eq("id", flowerBedId).eq("farm_id", farmId).maybeSingle();
  if (!bed?.shared_bed_id) return;
  await supabase
    .from("shared_beds")
    .update({
      length_m: geometry.lengthM,
      width_m: geometry.widthM,
      center_lng: geometry.center[0],
      center_lat: geometry.center[1],
      rotation_deg: geometry.rotationDeg,
    })
    .eq("id", bed.shared_bed_id);
  const { data: veg } = await supabase.from("veg_beds").select("id, block_id").eq("shared_bed_id", bed.shared_bed_id).maybeSingle();
  if (!veg) return;
  const { count } = await supabase.from("veg_beds").select("id", { count: "exact", head: true }).eq("block_id", veg.block_id);
  if (count !== 1) return;
  await supabase
    .from("veg_blocks")
    .update({
      center_lat: geometry.center[1],
      center_lng: geometry.center[0],
      rotation_deg: geometry.rotationDeg,
      span_length_m: geometry.lengthM,
      span_width_m: geometry.widthM,
      bed_length: geometry.lengthM,
      bed_width: geometry.widthM,
      unit: "m",
    })
    .eq("id", veg.block_id);
  await supabase.from("veg_beds").update({ length: geometry.lengthM, width: geometry.widthM }).eq("id", veg.id);
}

export async function followVegBlock(blockId: string) {
  const supabase = await createClient();
  const { data: bedsOnBlock } = await supabase.from("veg_beds").select("id, shared_bed_id").eq("block_id", blockId);
  for (const veg of bedsOnBlock ?? []) {
    if (!veg.shared_bed_id) continue;
    const geometry = await vegRectangle(supabase, veg.id as string);
    if (!geometry) continue;
    await supabase
      .from("shared_beds")
      .update({
        length_m: geometry.lengthM,
        width_m: geometry.widthM,
        center_lng: geometry.centerLng,
        center_lat: geometry.centerLat,
        rotation_deg: geometry.rotationDeg,
      })
      .eq("id", veg.shared_bed_id);
    const { data: flower } = await supabase.from("beds").select("id").eq("shared_bed_id", veg.shared_bed_id).maybeSingle();
    if (flower) await writeFlowerGeometry(supabase, flower.id as string, geometry);
  }
}

export async function sharedRoomForFlower(
  supabase: Awaited<ReturnType<typeof createClient>>,
  farmId: string,
  flowerBedIds: string[],
  proposed: ShareUse,
): Promise<string | null> {
  if (flowerBedIds.length === 0) return null;
  const { data: flowerBeds } = await supabase.from("beds").select("id, shared_bed_id").in("id", flowerBedIds).eq("farm_id", farmId);
  for (const bed of flowerBeds ?? []) {
    if (!bed.shared_bed_id) continue;
    const { data: veg } = await supabase.from("veg_beds").select("id").eq("shared_bed_id", bed.shared_bed_id).maybeSingle();
    if (!veg) continue;
    const uses = await usesOnVegBeds(supabase, farmId, [veg.id as string]);
    const current = uses.get(veg.id as string);
    if (!current) continue;
    const lengthM = proposed.lengthM > 0 ? proposed.lengthM : current.lengthM;
    const message = clashOnBed(current.name, current.lengthM, current.uses, { ...proposed, lengthM });
    if (message) return message;
  }
  return null;
}

export function clashOnBed(
  bedName: string,
  lengthM: number,
  existing: ShareUse[],
  proposed: ShareUse,
): string | null {
  const clash = sharedClashes(bedName, lengthM, [...existing, proposed])[0];
  return clash ? clashSentence(clash) : null;
}
