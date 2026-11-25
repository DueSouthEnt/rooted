import Link from "next/link";
import { GardenHeader } from "@/components/garden-header";
import { homeForSections, type Section } from "@/lib/sections";

const COPY: Record<Section, { title: string; lede: string }> = {
  flowers: {
    title: "Flowers aren't on your plan yet",
    lede: "You can add cut flowers whenever you like. The frost dates you already saved will be waiting.",
  },
  veg: {
    title: "Vegetables aren't on your plan yet",
    lede: "The veg beds are still being planted in the app. Add the section now and it will be here when it opens.",
  },
};

export function SectionBlocked({
  section,
  enabled,
  displayName,
}: {
  section: Section;
  enabled: readonly Section[];
  displayName: string;
}) {
  const copy = COPY[section];
  const home = homeForSections(enabled);
  return (
    <div className="min-h-full" data-testid="section-blocked">
      <GardenHeader enabled={enabled} current={null} displayName={displayName} />
      <main className="mx-auto max-w-xl px-5 py-16">
        <p className="text-sm tracking-[0.16em] text-muted-foreground uppercase">{section === "flowers" ? "Flowers" : "Veg"}</p>
        <h1 className="font-heading mt-2 text-4xl">{copy.title}</h1>
        <p className="mt-3 text-muted-foreground">{copy.lede}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/settings" className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground">
            Add it in settings
          </Link>
          <Link href={home} className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm">
            Back to your garden
          </Link>
        </div>
      </main>
    </div>
  );
}
