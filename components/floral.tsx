export type Bloom = "poppy" | "sweetpea" | "tulip" | "dahlia" | "cosmos" | "leaf";

const strokes: Record<Bloom, string> = {
  poppy: "#d9899a",
  sweetpea: "#c45b86",
  tulip: "#e7b7c6",
  dahlia: "#c46a7a",
  cosmos: "#e7a3c4",
  leaf: "#6d8a74",
};

export function BloomMark({ bloom, className = "h-14 w-20" }: { bloom: Bloom; className?: string }) {
  const stroke = strokes[bloom];
  return (
    <svg viewBox="0 0 80 56" aria-hidden className={className} fill="none" stroke={stroke} strokeWidth="1.3">
      {bloom === "leaf" ? (
        <path d="M10 40c18-4 28-18 30-32 2 16 14 30 32 32-16 2-26 10-32 18-4-8-14-16-30-18Z" fill="#e7f0e4" />
      ) : null}
      {bloom === "tulip" ? (
        <>
          <path d="M40 50 V28" strokeLinecap="round" />
          <path d="M40 30c-8-10-16-8-16 2 6 2 12 0 16-2Z" fill="#f7d5dc" />
          <path d="M40 30c8-10 16-8 16 2-6 2-12 0-16-2Z" fill="#f4e4e1" />
          <path d="M40 28c-4-8 0-14 0-14s4 6 0 14Z" fill="#fffaf4" />
        </>
      ) : null}
      {bloom === "poppy" ? (
        <>
          <path d="M40 48c2-10 2-16 0-24" strokeLinecap="round" />
          <circle cx="40" cy="18" r="8" fill="#fffaf4" />
          <path d="M40 8c-8-6-16-2-14 6 6 0 10-2 14-6Z" />
          <path d="M40 8c8-6 16-2 14 6-6 0-10-2-14-6Z" />
          <path d="M28 20c-8 2-10 10-4 12 4-4 8-8 4-12Z" fill="#f7d5dc" />
          <path d="M52 20c8 2 10 10 4 12-4-4-8-8-4-12Z" fill="#f4e4e1" />
        </>
      ) : null}
      {bloom === "sweetpea" ? (
        <>
          <path d="M18 46c8-14 16-20 22-28" strokeLinecap="round" />
          <path d="M40 18c8-8 18-6 16 4-8 2-14 0-16-4Z" fill="#f7d5dc" />
          <path d="M38 22c-2 10 6 16 14 14-4-6-8-12-14-14Z" fill="#f4e4e1" />
          <path d="M54 30c6 2 10 8 6 12-6-2-10-8-6-12Z" />
        </>
      ) : null}
      {bloom === "dahlia" ? (
        <>
          <circle cx="40" cy="24" r="5" fill="#f7d5dc" />
          <path d="M40 24 40 8M40 24 54 14M40 24 56 28M40 24 48 40M40 24 32 40M40 24 22 30M40 24 24 14M40 24 32 10" />
        </>
      ) : null}
      {bloom === "cosmos" ? (
        <>
          <circle cx="40" cy="24" r="3" fill="#e7a3c4" stroke="none" />
          <path d="M40 24c-2-12 2-16 0-16s2 4 0 16Z" />
          <path d="M40 24c10-6 16-4 16 0s-6 6-16 0Z" />
          <path d="M40 24c8 8 8 14 2 14s-8-6-2-14Z" />
          <path d="M40 24c-10 6-16 2-14-2s8-6 14 2Z" />
          <path d="M40 24c-8-8-6-14 0-14s6 8 0 14Z" />
        </>
      ) : null}
    </svg>
  );
}

export function PageHeader({
  bloom,
  kicker,
  title,
  lede,
}: {
  bloom: Bloom;
  kicker?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-border bg-card/80 px-5 py-4">
      <div className="pointer-events-none absolute top-1 right-2 opacity-80">
        <BloomMark bloom={bloom} />
      </div>
      {kicker ? <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{kicker}</p> : null}
      <h1 className="font-heading relative max-w-xl text-4xl tracking-tight">{title}</h1>
      {lede ? <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{lede}</p> : null}
      <div className="mt-3 h-px w-24 bg-gradient-to-r from-[#f7d5dc] to-transparent" />
    </header>
  );
}

export function EmptyFlourish({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-8 text-center">
      <div className="mx-auto w-fit">
        <BloomMark bloom="cosmos" className="h-16 w-24" />
      </div>
      <p className="font-heading mt-2 text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
