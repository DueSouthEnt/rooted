"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";
import { signOut, updateUnits } from "@/lib/actions";
import type { Units } from "@/lib/units";

const links = [
  { href: "", label: "Farm" },
  { href: "/flowers", label: "Flowers" },
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

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/app" className="font-heading text-2xl tracking-tight">
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
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[180px_1fr]">
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
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card md:hidden">
          {links.map((link) => {
            const href = `${base}${link.href}`;
            const active = link.href === "" ? pathname === base : pathname.startsWith(href);
            return (
              <Link
                key={link.label}
                href={href}
                className={active ? "px-2 py-3 text-center text-sm font-medium text-primary" : "px-2 py-3 text-center text-sm text-muted-foreground"}
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
