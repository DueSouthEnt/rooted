import { createClient } from "@/lib/supabase/server";
import { standardBedLengthMetres } from "@/lib/veg/bed-length";

/** The farm's usual bed length, in metres. Missing column or row means 15 m. */
export async function readStandardBedLength(farmId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("veg_farm_settings").select("standard_bed_length_m").eq("farm_id", farmId).maybeSingle();
    if (error) return standardBedLengthMetres(null);
    return standardBedLengthMetres(data?.standard_bed_length_m);
  } catch {
    return standardBedLengthMetres(null);
  }
}
