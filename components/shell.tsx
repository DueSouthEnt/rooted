"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FloralBanner } from "@/components/floral-banner";
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
          <Link href="/app" className="wordmark flex items-center gap-2 text-foreground">
            <BouquetMark />
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
      <FloralBanner />
      <div className={`mx-auto grid gap-6 px-4 pt-5 pb-6 md:grid-cols-[200px_1fr] ${wide ? "max-w-[1500px]" : "max-w-6xl"}`}>
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

function BouquetMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-9 text-[#3f5c49]">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 44V26" />
        <path d="M24 32c-6 2-10 8-10 8" />
        <path d="M24 34c6 1 11 6 11 6" />
        <path stroke="#d9899a" d="M24 18c-4-6-12-6-12 1 4 1 8 2 12 6 4-4 8-5 12-6 0-7-8-7-12-1Z" />
        <path stroke="#c45b86" d="M14 22c-5-3-10-1-10 4 4 1 7 1 10 4 2-3 2-6 0-8Z" />
        <path stroke="#6d8a74" d="M34 22c5-3 10-1 10 4-4 1-7 1-10 4-2-3-2-6 0-8Z" />
        <path stroke="#e7b7c6" d="M18 14c-3-5-1-9 3-9 1 4 1 6 2 8" />
        <path stroke="#e7b7c6" d="M30 14c3-5 1-9-3-9-1 4-1 6-2 8" />
      </g>
    </svg>
  );
}
