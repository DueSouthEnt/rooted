import { SectionBlocked } from "@/components/section-blocked";
import { GardenHeader } from "@/components/garden-header";
import { loadProfile } from "@/lib/records";

export default async function VegLayout({ children }: { children: React.ReactNode }) {
  const profile = await loadProfile();
  if (!profile.enabledSections.includes("veg")) {
    return <SectionBlocked section="veg" enabled={profile.enabledSections} displayName={profile.displayName} />;
  }
  return (
    <div className="min-h-full">
      <GardenHeader enabled={profile.enabledSections} current="veg" displayName={profile.displayName} />
      {children}
    </div>
  );
}
