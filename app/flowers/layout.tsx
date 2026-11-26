import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SectionBlocked } from "@/components/section-blocked";
import { Shell } from "@/components/shell";
import { listFarms } from "@/lib/actions";
import { loadProfile } from "@/lib/records";

export default async function FlowersLayout({ children }: { children: React.ReactNode }) {
  const profile = await loadProfile();
  if (!profile.approved) redirect("/waiting");
  if (!profile.enabledSections.includes("flowers")) {
    return <SectionBlocked section="flowers" enabled={profile.enabledSections} displayName={profile.displayName} />;
  }
  const listed = await listFarms();
  return (
    <Suspense>
      <Shell
        displayName={profile.displayName}
        units={profile.units === "imperial" ? "imperial" : "metric"}
        farms={listed.farms.map((farm) => ({ id: farm.id, name: farm.name }))}
        enabledSections={profile.enabledSections}
      >
        {children}
      </Shell>
    </Suspense>
  );
}
