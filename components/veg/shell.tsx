"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  Leaf,
  ListChecks,
  Map,
  MapPin,
  Menu,
  Wheat,
} from "lucide-react";
import { PaletteSwitch } from "@/components/veg/palette-switch";
import { SectionSwitch } from "@/components/section-switch";
import { APP_NAME } from "@/lib/brand";
import type { Section } from "@/lib/sections";
import { Button } from "@/components/veg/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/veg/ui/sheet";
import { cn } from "@/lib/veg/utils";

const NAV = [
  { href: "/veg", label: "Overview", icon: LayoutDashboard },
  { href: "/veg/farm", label: "Farm map", icon: Map },
  { href: "/veg/plan", label: "Game plan", icon: CalendarRange },
  { href: "/veg/timeline", label: "Year plan", icon: CalendarDays },
  { href: "/veg/tasks", label: "Tasks", icon: ListChecks },
  { href: "/veg/crops", label: "Crops", icon: Leaf },
  { href: "/veg/harvest", label: "Harvest", icon: Wheat },
  { href: "/veg/settings", label: "Frost dates", icon: MapPin },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {NAV.map((item) => {
        const active = item.href === "/veg" ? pathname === "/veg" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/veg" className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path d="M12 21V11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 14c-4-1-6-5-5-8 3 1 5 4 5 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 12c4-1 6-4 5-7-3 1-5 4-5 7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        <span className="block font-display text-lg leading-none text-sidebar-foreground">{APP_NAME}</span>
        <span className="mt-1 block text-xs leading-4 text-sidebar-foreground/80">Vegetables</span>
      </span>
    </Link>
  );
}

export function AppShell({
  seasonSlot,
  enabledSections,
  children,
}: {
  seasonSlot: React.ReactNode;
  enabledSections: readonly Section[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <div className="sidebar-soil hidden border-r border-sidebar-border bg-sidebar lg:block">
        <aside className="sticky top-0 flex h-screen flex-col px-4 py-5 text-sidebar-foreground">
          <Brand />
          <div className="mt-8 flex-1">
            <NavLinks />
          </div>
          <PaletteSwitch />
          <p className="mt-4 px-1 text-xs leading-5 text-sidebar-foreground/80">
            Dates stay on the calendar. Yields are plans, not promises.
          </p>
          <p className="mt-2 px-1 text-[11px] leading-4 text-sidebar-foreground/80">
            Banner drawing supplied by the site owner.
          </p>
        </aside>
      </div>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon" className="bg-card" aria-label="Open menu" />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar text-sidebar-foreground">
                <SheetHeader>
                  <SheetTitle className="text-sidebar-foreground">
                    <Brand />
                  </SheetTitle>
                </SheetHeader>
                <div className="grid gap-6 px-4">
                  <NavLinks />
                  <PaletteSwitch />
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-display text-xl lg:hidden">{APP_NAME}</span>
          </div>
          <p className="hidden text-sm text-muted-foreground lg:block">
            Beds, successions, and the week ahead.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <SectionSwitch enabled={enabledSections} current="veg" />
            {seasonSlot}
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
