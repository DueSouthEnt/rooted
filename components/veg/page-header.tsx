export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-3xl tracking-tight text-balance sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3 shadow-[0_1px_0_rgba(60,40,10,0.04)]">
      <div className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 font-display text-3xl leading-none num">{value}</div>
      {detail ? <div className="mt-1.5 text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
