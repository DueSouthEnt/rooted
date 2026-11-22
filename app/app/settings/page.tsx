import { PageHeader } from "@/components/floral";
import { updateUnits } from "@/lib/actions";
import { loadProfile } from "@/lib/records";

export default async function SettingsPage() {
  const { units } = await loadProfile();
  const next = units === "metric" ? "imperial" : "metric";
  return (
    <div className="space-y-4">
      <PageHeader
        bloom="leaf"
        kicker="Operations"
        title="Settings"
        lede="Metres and Celsius are the default. Inches and Fahrenheit are there for a seed packet that still thinks in them."
      />
      <form action={updateUnits} className="rounded-2xl border border-border bg-card p-4">
        <input type="hidden" name="units" value={next} />
        <p className="text-sm">Showing {units === "metric" ? "centimetres and Celsius" : "inches and Fahrenheit"}.</p>
        <button type="submit" className="mt-3 h-11 rounded-full bg-primary px-4 text-sm text-primary-foreground">
          Switch to {next === "metric" ? "cm / °C" : "in / °F"}
        </button>
      </form>
    </div>
  );
}
