import type { Metadata } from "next";

export const metadata: Metadata = { title: "Veg" };

export default function VegHomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12" data-testid="veg-home">
      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_24px_60px_-36px_rgba(44,64,52,0.45)]">
        <div className="bg-[linear-gradient(180deg,#f7f1e6_0%,#e7d3bc_100%)] px-4 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/veg-banner.webp" alt="" className="mx-auto h-40 w-full object-contain object-bottom sm:h-56" />
        </div>
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-sm tracking-[0.16em] text-muted-foreground uppercase">Vegetables</p>
          <h1 className="font-heading mt-2 text-4xl sm:text-5xl">Veg section coming soon</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#4a433c]">
            The sowings, the beds, and the harvest list are the next thing we plant. Your place on the plan is saved.
            Flowers are ready now if you grow those too.
          </p>
        </div>
      </section>
    </main>
  );
}
