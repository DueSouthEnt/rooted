"use server";

import { revalidatePath } from "next/cache";
import { createClient as createService } from "@supabase/supabase-js";
import { loadProfile } from "@/lib/records";

async function requireAdmin() {
  const profile = await loadProfile();
  if (!profile.isAdmin) throw new Error("Not allowed.");
  return profile;
}

export async function setApproved(id: string, approved: boolean): Promise<void> {
  const profile = await requireAdmin();
  const { error } = await profile.supabase.rpc("admin_set_approved", { target: id, value: approved });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function deleteAccount(id: string): Promise<void> {
  const profile = await requireAdmin();
  if (id === profile.user.id) throw new Error("You cannot delete your own account.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY on the server to delete accounts. It is never sent to the browser.");
  }
  const service = createService(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
