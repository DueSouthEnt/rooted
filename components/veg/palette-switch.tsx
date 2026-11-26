"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/veg/utils";

export const PALETTES = [
  { id: "sapphire", label: "Sapphire" },
  { id: "sage", label: "Sage" },
  { id: "spruce", label: "Spruce" },
  { id: "earth", label: "Earth" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

const STORAGE_KEY = "sprout-palette";

/** Older saved names from the first palette set. */
const LEGACY: Record<string, PaletteId> = {
  meadow: "sapphire",
  hedgerow: "spruce",
  earth: "earth",
  sapphire: "sapphire",
  sage: "sage",
  spruce: "spruce",
};

export function normalizePalette(value: string | null | undefined): PaletteId {
  if (!value) return "spruce";
  return LEGACY[value] ?? "spruce";
}

function currentPalette(): PaletteId {
  return normalizePalette(document.documentElement.dataset.palette);
}

export function applyPalette(palette: PaletteId) {
  document.documentElement.dataset.palette = palette;
  try {
    localStorage.setItem(STORAGE_KEY, palette);
  } catch {
    // The choice still applies for this visit.
  }
}

export function PaletteSwitch() {
  const [palette, setPalette] = useState<PaletteId>("spruce");

  useEffect(() => {
    setPalette(currentPalette());
  }, []);

  return (
    <div className="grid gap-1.5" data-testid="palette-switch">
      <p className="px-1 text-[11px] font-medium tracking-[0.14em] text-sidebar-foreground/80 uppercase">Palette</p>
      <div className="grid grid-cols-2 gap-1">
        {PALETTES.map((option) => {
          const active = palette === option.id;
          return (
            <button
              key={option.id}
              type="button"
              data-testid={`palette-${option.id}`}
              aria-pressed={active}
              onClick={() => {
                applyPalette(option.id);
                setPalette(option.id);
              }}
              className={cn(
                "rounded-md px-1 py-1.5 text-[11px] leading-none",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
