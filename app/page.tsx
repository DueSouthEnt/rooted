import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { Disclaimer } from "@/components/disclaimer";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-10">
      <p className="text-sm tracking-[0.16em] text-muted-foreground uppercase">{APP_NAME}</p>
      <h1 className="font-heading mt-3 text-5xl leading-tight tracking-tight sm:text-6xl">{APP_TAGLINE}</h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed">
        For people growing flowers to cut, on a scale from a few beds to a small field. Tell it where you are. It works out the frost, suggests what is actually likely to flower, and writes the jobs down by week.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button nativeButton={false} render={<Link href="/signup" />} className="h-12 px-5 text-base">
          Start a plan
        </Button>
        <Button nativeButton={false} render={<Link href="/login" />} variant="outline" className="h-12 px-5 text-base">
          I already have one
        </Button>
      </div>
      <ol className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          ["1", "Where you grow", "A UK postcode, a European town, or a pin in the map. Frost dates come from recent winters, with RHS and USDA hardiness beside them."],
          ["2", "What to grow", "A catalogue of cut flowers, ranked for your season. Autumn-sown sweet peas if that's the sensible thing. Dahlias after the frost, not before."],
          ["3", "What to do this week", "Sow, pinch, net, cut, lift. Tick them off in the field. The dates are estimates. Your garden still gets the last word."],
        ].map(([step, title, copy]) => (
          <li key={step} className="rounded-xl border border-border bg-card p-4">
            <p className="font-heading text-3xl">{step}</p>
            <h2 className="mt-2 font-medium">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10">
        <Disclaimer />
      </div>
    </div>
  );
}
