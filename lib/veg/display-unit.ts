import { createClient } from "@/lib/supabase/server";

/** The unit the farm map uses on screen. Lengths in the database stay in metres. */
export async function readDisplayUnit(): Promise<"m" | "ft"> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return "m";
    const { data: farms } = await supabase.from("farms").select("id").eq("user_id", auth.user.id).order("created_at").limit(1);
    const farmId = farms?.[0]?.id;
    if (!farmId) return "m";
    const { data, error } = await supabase.from("veg_farm_settings").select("display_unit").eq("farm_id", farmId).maybeSingle();
    if (error || data?.display_unit !== "ft") return "m";
    return "ft";
  } catch {
    return "m";
  }
}
