import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SectionBlocked } from "@/components/section-blocked";
import { AppShell } from "@/components/veg/shell";
import { SeasonSwitcher } from "@/components/veg/season-switcher";
import { Toaster } from "@/components/veg/ui/sonner";
import { listSeasonYears } from "@/lib/veg/queries";
import { getSeason, seasonChoices } from "@/lib/veg/season";
import { loadProfile } from "@/lib/records";
import "./theme.css";

async function SeasonSlot() {
  const season = await getSeason();
  const years = seasonChoices(season, await listSeasonYears());
  return <SeasonSwitcher season={season} years={years} />;
}

export default async function VegLayout({ children }: { children: React.ReactNode }) {
  const profile = await loadProfile();
  if (!profile.approved) redirect("/waiting");
  if (!profile.enabledSections.includes("veg")) {
    return <SectionBlocked section="veg" enabled={profile.enabledSections} displayName={profile.displayName} />;
  }
  return (
    <div data-palette="spruce" className="min-h-full text-foreground">
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <AppShell
          enabledSections={profile.enabledSections}
          seasonSlot={
            <Suspense fallback={<div className="h-8 w-28 rounded-lg bg-muted" />}>
              <SeasonSlot />
            </Suspense>
          }
        >
          {children}
        </AppShell>
      </Suspense>
      <Toaster position="top-center" />
    </div>
  );
}
