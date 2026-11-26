import Link from "next/link";
import type { Section } from "@/lib/sections";

const LABEL: Record<Section, string> = {
  flowers: "Flowers",
  veg: "Veg",
};

export function SectionSwitch({
  enabled,
  current,
}: {
  enabled: readonly Section[];
  current: Section | null;
}) {
  if (enabled.length < 2) return null;
  return (
    <nav aria-label="Section" data-testid="section-switch" className="flex rounded-full border border-border bg-card p-0.5 text-sm">
      {enabled.map((section) => {
        const active = section === current;
        return (
          <Link
            key={section}
            href={section === "flowers" ? "/flowers" : "/veg"}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
                : "rounded-full px-3 py-1 text-foreground hover:bg-secondary"
            }
          >
            {LABEL[section]}
          </Link>
        );
      })}
    </nav>
  );
}
