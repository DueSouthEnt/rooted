import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { SectionSwitch } from "@/components/section-switch";
import { APP_NAME } from "@/lib/brand";
import { signOut } from "@/lib/actions";
import { homeForSections, type Section } from "@/lib/sections";

export function GardenHeader({
  enabled,
  current,
  displayName,
}: {
  enabled: readonly Section[];
  current: Section | null;
  displayName: string;
}) {
  return (
    <header className="border-b border-border bg-card/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={homeForSections([...enabled])} className="wordmark flex items-center gap-2 text-foreground">
          <BrandMark className="size-9 text-[#3f5c49]" />
          {APP_NAME}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SectionSwitch enabled={enabled} current={current} />
          <span className="hidden text-muted-foreground sm:inline">{displayName}</span>
          <form action={signOut}>
            <button type="submit" className="rounded-full px-3 py-1 hover:bg-secondary">
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
