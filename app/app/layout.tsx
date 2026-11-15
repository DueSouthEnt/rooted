import { Shell } from "@/components/shell";
import { loadProfile } from "@/lib/records";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { displayName, units } = await loadProfile();
  return (
    <Shell displayName={displayName} units={units === "imperial" ? "imperial" : "metric"}>
      {children}
    </Shell>
  );
}
