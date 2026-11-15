"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { APP_NAME } from "@/lib/brand";
import { signOut, updateUnits } from "@/lib/actions";
import type { Units } from "@/lib/units";

export function Shell({
  displayName,
  units,
  farms,
  children,
}: {
  displayName: string;
  units: Units;
  farms: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const match = pathname.match(/^\/app\/farms\/([0-9a-f-]{36})/);
  const queried = search.get("farm");
  const farmId = match?.[1] ?? (queried && farms.some((farm) => farm.id === queried) ? queried : farms[0]?.id);
  const farm = farms.find((item) => item.id === farmId);
  const base = farmId ? `/app/farms/${farmId}` : null;
  const wide = /\/(map|timeline|plan|harvest)/.test(pathname);

  const groups = [
    {
      title: "Your farm",
      links: base
        ? [{ href: base, label: farm?.name ?? "Farm" }]
        : [{ href: "/app/farms/new", label: "Add a farm" }],
    },
    {
      title: "Overview",
      links: [{ href: farmId ? `/app?farm=${farmId}` : "/app", label: "Dashboard" }],
    },
    {
      title: "The year",
      links: base
        ? [
            { href: `${base}/plants`, label: "Plants" },
            { href: `${base}/plan`, label: "Game plan" },
            { href: `${base}/timeline`, label: "Year plan" },
            { href: `${base}/harvest`, label: "Harvest" },
            { href: `${base}/week`, label: "Tasks" },
          ]
        : [],
    },
    {
      title: "The ground",
      links: base
        ? [
            { href: `${base}/map`, label: "Farm map" },
            { href: `${base}/beds`, label: "Beds" },
          ]
        : [],
    },
    {
      title: "Flowers",
      links: base ? [{ href: `${base}/flowers`, label: "What will grow" }] : [],
    },
    {
      title: "Operations",
      links: [
        ...(base ? [{ href: `${base}/place`, label: "Frost dates" }] : []),
        { href: "/app/guide", label: "What the words mean" },
        { href: "/app/settings", label: "Settings" },
      ],
    },
  ];

  const mobile = base
    ? [
        { href: `/app?farm=${farmId}`, label: "Home" },
        { href: `${base}/timeline`, label: "Year" },
        { href: `${base}/plan`, label: "Plan" },
        { href: `${base}/map`, label: "Map" },
        { href: `${base}/week`, label: "Tasks" },
      ]
    : [];

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-3 ${wide ? "max-w-[1500px]" : "max-w-6xl"}`}>
          <Link href="/app" className="font-heading flex items-center gap-2 text-2xl tracking-tight">
            <FlowerMark />
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <form action={updateUnits}>
              <input type="hidden" name="units" value={units === "metric" ? "imperial" : "metric"} />
              <button type="submit" className="rounded-full border border-border px-3 py-1 hover:bg-secondary">
                {units === "metric" ? "cm / °C" : "in / °F"}
              </button>
            </form>
            <span className="hidden text-muted-foreground sm:inline">{displayName}</span>
            <form action={signOut}>
              <button type="submit" className="rounded-full px-3 py-1 hover:bg-secondary">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className={`mx-auto grid gap-6 px-4 py-6 md:grid-cols-[200px_1fr] ${wide ? "max-w-[1500px]" : "max-w-6xl"}`}>
        <nav className="hidden flex-col gap-4 md:flex">
          {groups.map((group) =>
            group.links.length === 0 ? null : (
              <div key={group.title}>
                <p className="px-3 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{group.title}</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  {group.links.map((link) => {
                    const active = link.href === pathname || (link.href.startsWith("/app?") && pathname === "/app");
                    return (
                      <Link
                        key={link.href + link.label}
                        href={link.href}
                        className={
                          active ? "rounded-lg bg-primary px-3 py-2 text-primary-foreground" : "rounded-lg px-3 py-2 hover:bg-secondary"
                        }
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </nav>
        <main className="min-w-0 pb-24 md:pb-6">{children}</main>
      </div>
      {mobile.length > 0 ? (
        <nav className="fixed inset-x-0 bottom-0 z-[1000] grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur-sm md:hidden">
          {mobile.map((link) => {
            const active = link.label === "Home" ? pathname === "/app" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                className={active ? "px-1 py-3 text-center text-xs font-medium text-primary" : "px-1 py-3 text-center text-xs text-muted-foreground"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

function FlowerMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="size-7 text-primary">
      <circle cx="16" cy="14" r="3" fill="#f3c1cb" />
      <path d="M16 17c0 4-3 8-3 8M16 17c0 4 3 8 3 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 11c-3-4-8-4-9-1 3 1 6 2 9 5 3-3 6-4 9-5-1-3-6-3-9 1Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
