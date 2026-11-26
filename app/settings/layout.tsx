import { redirect } from "next/navigation";
import { GardenHeader } from "@/components/garden-header";
import { loadProfile } from "@/lib/records";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await loadProfile();
  if (!profile.approved) redirect("/waiting");
  return (
    <div className="min-h-full">
      <GardenHeader enabled={profile.enabledSections} current={null} displayName={profile.displayName} />
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
