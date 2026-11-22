import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { listFarms } from "@/lib/actions";
import { loadProfile } from "@/lib/records";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [{ displayName, units }, listed] = await Promise.all([loadProfile(), listFarms()]);
  return (
    <Suspense>
      <Shell
        displayName={displayName}
        units={units === "imperial" ? "imperial" : "metric"}
        farms={listed.farms.map((farm) => ({ id: farm.id, name: farm.name }))}
      >
        {children}
      </Shell>
    </Suspense>
  );
}
