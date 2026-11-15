"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";
import { signOut, updateUnits } from "@/lib/actions";
import type { Units } from "@/lib/units";

const links = [
  { href: "", label: "Farm" },
  { href: "/flowers", label: "Flowers" },
  { href: "/map", label: "Map" },
  { href: "/beds", label: "Beds" },
  { href: "/week", label: "Week" },
];

export function Shell({
  displayName,
  units,
  children,
}: {
  displayName: string;
  units: Units;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const match = pathname.match(/^\/app\/farms\/([0-9a-f-]{36})/);
  const farmId = match?.[1];
  const base = farmId ? `/app/farms/${farmId}` : null;
  const wide = pathname.includes("/map");

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-3 ${wide ? "max-w-[1400px]" : "max-w-5xl"}`}>
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
      <div className={`mx-auto grid gap-6 px-4 py-6 md:grid-cols-[180px_1fr] ${wide ? "max-w-[1400px]" : "max-w-5xl"}`}>
        <nav className="hidden flex-col gap-1 md:flex">
          <Link href="/app" className="rounded-lg px-3 py-2 hover:bg-secondary">
            Your farms
          </Link>
          <Link href="/app/guide" className="rounded-lg px-3 py-2 hover:bg-secondary">
            What the words mean
          </Link>
          {base
            ? links.map((link) => {
                const href = `${base}${link.href}`;
                const active = link.href === "" ? pathname === base : pathname.startsWith(href);
                return (
                  <Link
                    key={link.label}
                    href={href}
                    className={active ? "rounded-lg bg-primary px-3 py-2 text-primary-foreground" : "rounded-lg px-3 py-2 hover:bg-secondary"}
                  >
                    {link.label}
                  </Link>
                );
              })
            : null}
        </nav>
        <main className="min-w-0 pb-24 md:pb-6">{children}</main>
      </div>
      {base ? (
        <nav className="fixed inset-x-0 bottom-0 z-[1000] grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur-sm md:hidden">
          {links.map((link) => {
            const href = `${base}${link.href}`;
            const active = link.href === "" ? pathname === base : pathname.startsWith(href);
            return (
              <Link
                key={link.label}
                href={href}
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
