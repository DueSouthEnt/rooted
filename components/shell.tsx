"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { FloralBanner } from "@/components/floral-banner";
import { SectionSwitch } from "@/components/section-switch";
import { APP_NAME } from "@/lib/brand";
import { signOut, updateUnits } from "@/lib/actions";
import type { Section } from "@/lib/sections";
import type { Units } from "@/lib/units";

export function Shell({
  displayName,
  units,
  farms,
  enabledSections,
  children,
}: {
  displayName: string;
  units: Units;
  farms: { id: string; name: string }[];
  enabledSections: readonly Section[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const match = pathname.match(/^\/flowers\/farms\/([0-9a-f-]{36})/);
  const queried = search.get("farm");
  const farmId = match?.[1] ?? (queried && farms.some((farm) => farm.id === queried) ? queried : farms[0]?.id);
  const farm = farms.find((item) => item.id === farmId);
  const base = farmId ? `/flowers/farms/${farmId}` : null;
  const wide = /\/(map|timeline|plan|harvest)/.test(pathname);

  const groups = [
    {
      title: "Your farm",
      links: base
        ? [{ href: base, label: farm?.name ?? "Farm" }]
        : [{ href: "/flowers/farms/new", label: "Add a farm" }],
    },
    {
      title: "Overview",
      links: [{ href: farmId ? `/flowers?farm=${farmId}` : "/flowers", label: "Dashboard" }],
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
        { href: "/flowers/guide", label: "What the words mean" },
        { href: "/settings", label: "Settings" },
      ],
    },
  ];

  const mobile = base
    ? [
        { href: `/flowers?farm=${farmId}`, label: "Home" },
        { href: `${base}/timeline`, label: "Year" },
        { href: `${base}/plan`, label: "Plan" },
        { href: `${base}/map`, label: "Map" },
        { href: `${base}/week`, label: "Tasks" },
      ]
    : [];

  return (
    <div className="min-h-full" data-testid="flowers-shell">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${wide ? "max-w-[1500px]" : "max-w-6xl"}`}>
          <Link href="/flowers" className="wordmark flex items-center gap-2 text-foreground">
            <BrandMark className="size-9 text-[#3f5c49]" />
            {APP_NAME}
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <SectionSwitch enabled={enabledSections} current="flowers" />
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
      <div className={`mx-auto grid gap-6 px-4 pt-5 pb-6 md:grid-cols-[15.5rem_1fr] ${wide ? "max-w-[1500px]" : "max-w-6xl"}`}>
        <nav className="sticky top-4 hidden h-fit flex-col gap-4 self-start rounded-2xl bg-[#2c4034] p-3 text-[#f6f1e8] md:flex">
          {groups.map((group) =>
            group.links.length === 0 ? null : (
              <div key={group.title}>
                <p className="px-3 text-[11px] tracking-[0.16em] text-[#e7d3bc] uppercase">{group.title}</p>
                <div className="mt-1 flex flex-col gap-0.5">
                  {group.links.map((link) => {
                    const active = link.href === pathname || (link.href.startsWith("/flowers?") && pathname === "/flowers");
                    return (
                      <Link
                        key={link.href + link.label}
                        href={link.href}
                        className={
                          active
                            ? "rounded-lg bg-[#f4efe4] px-3 py-2 text-[#2c4034]"
                            : "rounded-lg px-3 py-2 text-[#f6f1e8] hover:bg-white/10"
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
            const active = link.label === "Home" ? pathname === "/flowers" : pathname.startsWith(link.href);
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
