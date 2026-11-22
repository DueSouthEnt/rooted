import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { Disclaimer } from "@/components/disclaimer";
import { FloralBanner } from "@/components/floral-banner";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-full">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-8">
        <p className="wordmark text-foreground">{APP_NAME}</p>
        <Link href="/login" className="text-sm underline decoration-[#e4d5c8] underline-offset-4">
          Log in
        </Link>
      </div>
      <div className="mt-6">
        <FloralBanner />
      </div>
      <div className="mx-auto flex max-w-5xl flex-col px-5 py-8 sm:py-10">
        <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm tracking-[0.18em] text-muted-foreground uppercase">Cut flowers, planned properly</p>
            <h1 className="font-heading mt-3 max-w-xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              {APP_TAGLINE}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#4a433c]">
              For a few beds or a whole field. Tell Rooted where you grow. It works out the frost, suggests what will actually flower there, and writes the week down so you can take it outside.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button nativeButton={false} render={<Link href="/signup" />} className="h-12 px-6 text-base">
                Start a plan
              </Button>
              <Button nativeButton={false} render={<Link href="/login" />} variant="outline" className="h-12 bg-card/80 px-6 text-base">
                I already have one
              </Button>
            </div>
          </div>
          <div className="rounded-[1.6rem] border border-border bg-card/90 p-5 shadow-[0_20px_50px_-30px_rgba(63,92,73,0.45)]">
            <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">A first season, somewhere mild</p>
            <p className="font-heading mt-2 text-3xl">Last frost 12 April</p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ["Sweet pea", "Sown in autumn, under cover"],
                ["Calendula", "Hardy, and it forgives you"],
                ["Dahlia", "After the frost, not before"],
              ].map(([name, note]) => (
                <li key={name} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/70 px-3 py-2">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground">{note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">Slugs will not read the plan. You still should.</p>
          </div>
        </section>

        <ol className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            ["Where you grow", "A postcode, a town, or a pin. Then draw the land on a satellite picture and measure the beds in metres."],
            ["What to grow", "Flowers ranked for your frost dates. Autumn-sown hardy annuals when that is the sensible British thing."],
            ["This week", "Sow, pinch, net, cut, lift. Tick them off in the field. The dates are estimates. The garden still gets the last word."],
          ].map(([title, copy], index) => (
            <li key={title} className="rounded-2xl border border-border bg-card/80 p-5">
              <p className="font-heading text-3xl text-primary">{index + 1}</p>
              <h2 className="mt-2 font-medium">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 max-w-2xl">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
