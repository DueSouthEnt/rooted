import Link from "next/link";
import { PageHeader } from "@/components/floral";
import { enableSection, updateUnits } from "@/lib/actions";
import { loadProfile } from "@/lib/records";
import type { Section } from "@/lib/sections";

const LABEL: Record<Section, string> = {
  flowers: "Flowers",
  veg: "Veg",
};

export default async function SettingsPage() {
  const { units, enabledSections, isAdmin } = await loadProfile();
  const next = units === "metric" ? "imperial" : "metric";
  const missing = (["flowers", "veg"] as const).filter((section) => !enabledSections.includes(section));
  return (
    <div className="space-y-4" data-testid="settings">
      <PageHeader
        bloom="leaf"
        kicker="Your garden"
        title="Settings"
        lede="Metres and Celsius are the default. Inches and Fahrenheit are there for a seed packet that still thinks in them. Add the other section whenever you start growing it."
      />
      <form action={updateUnits} className="rounded-2xl border border-border bg-card p-4">
        <input type="hidden" name="units" value={next} />
        <p className="text-sm">Showing {units === "metric" ? "centimetres and Celsius" : "inches and Fahrenheit"}.</p>
        <button type="submit" className="mt-3 h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground">
          Switch to {next === "metric" ? "cm / °C" : "in / °F"}
        </button>
      </form>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">Sections</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          On your plan: {enabledSections.map((section) => LABEL[section]).join(" and ")}.
        </p>
        {missing.map((section) => (
          <form key={section} action={enableSection} className="mt-3">
            <input type="hidden" name="section" value={section} />
            <button type="submit" className="h-11 rounded-full border border-border px-4 text-sm hover:bg-secondary">
              Add {LABEL[section].toLowerCase()}
            </button>
          </form>
        ))}
      </section>
      {isAdmin ? (
        <p className="text-sm">
          <Link href="/admin" className="underline">
            Approve new accounts
          </Link>
        </p>
      ) : null}
    </div>
  );
}
