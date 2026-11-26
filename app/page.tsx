import Link from "next/link";
import { APP_NAME, APP_WELCOME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { Disclaimer } from "@/components/disclaimer";
import { SignupForm } from "@/components/signup-form";
import { createClient } from "@/lib/supabase/server";
import { homeForSections, normalizeSections } from "@/lib/sections";

const STEPS = [
  ["Where you grow", "A postcode, a town, or a pin. Then draw the land on a satellite picture and measure the beds in metres."],
  ["What to grow", "Flowers ranked for your frost dates. Autumn-sown hardy annuals when that is the sensible British thing."],
  ["This week", "Sow, pinch, net, cut, lift. Tick them off in the field. The dates are estimates. The garden still gets the last word."],
] as const;

async function viewerHome(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("enabled_sections").eq("id", data.user.id).maybeSingle();
  return homeForSections(normalizeSections(profile?.enabled_sections));
}

export default async function HomePage() {
  const home = await viewerHome();
  return (
    <div className="min-h-full" data-testid="landing">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-6 sm:px-6 sm:pt-8">
        <p className="wordmark flex items-center gap-2 text-foreground">
          <BrandMark className="size-9 text-[#3f5c49]" />
          {APP_NAME}
        </p>
        <Link href={home ?? "/login"} className="text-sm underline decoration-[#e4d5c8] underline-offset-4">
          {home ? "Your garden" : "Log in"}
        </Link>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <section className="overflow-hidden rounded-[1.75rem] border border-border bg-[#f7f1e6] shadow-[0_24px_60px_-36px_rgba(44,64,52,0.55)]">
          <div className="bg-[linear-gradient(180deg,#f7f1e6_0%,#f3e6d4_70%,#e7d3bc_100%)] px-5 pt-8 sm:px-8 sm:pt-10">
            <h1 className="font-heading text-center text-4xl leading-[1.05] tracking-tight sm:text-6xl">Plan your growing year</h1>
            <div className="mt-6 grid grid-cols-1 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/floral-banner.webp"
                alt=""
                className="col-start-1 h-36 w-full object-cover object-left-bottom sm:h-56"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/veg-banner.webp"
                alt=""
                className="col-start-1 h-36 w-full object-contain object-bottom sm:col-start-3 sm:h-56"
              />
              <p className="font-heading col-start-1 mt-4 text-center text-5xl leading-none tracking-tight text-[#2c4034] sm:mt-3 sm:text-6xl">
                Flowers
              </p>
              <p className="col-start-1 py-2 text-center text-lg text-[#6d645c] sm:col-start-2 sm:row-start-2 sm:px-5 sm:pb-2">and</p>
              <p className="font-heading col-start-1 text-center text-5xl leading-none tracking-tight text-[#2c4034] sm:col-start-3 sm:row-start-2 sm:text-6xl">
                Vegetables
              </p>
            </div>
          </div>
          <div className="px-5 pt-4 pb-8 sm:px-8 sm:pb-10">
            <p className="mx-auto max-w-2xl text-center text-lg leading-relaxed text-[#4a433c]">{APP_WELCOME}</p>
          </div>
        </section>

        <section className="mt-10 sm:mt-14">
          {home ? (
            <div className="rounded-[1.4rem] border border-border bg-card p-6">
              <h2 className="font-heading text-3xl">You're already signed in.</h2>
              <p className="mt-2 text-muted-foreground">The year is where you left it.</p>
              <Link href={home} className="mt-5 inline-flex h-12 items-center rounded-full bg-primary px-6 text-primary-foreground">
                Continue to your garden
              </Link>
            </div>
          ) : (
            <SignupForm />
          )}
        </section>

        <section className="mt-12 sm:mt-16" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="font-heading text-3xl">
            How it works
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([title, copy], index) => (
              <li key={title} className="rounded-2xl border border-border bg-card/80 p-5">
                <p className="font-heading text-3xl text-primary">{index + 1}</p>
                <h3 className="mt-2 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 max-w-2xl">
          <Disclaimer />
        </div>
      </main>
    </div>
  );
}
