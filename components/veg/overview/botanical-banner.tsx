"use client";

import { useEffect, useState } from "react";

export function WeekGreeting({ farm }: { farm: string }) {
  const [hello, setHello] = useState("Hello");
  useEffect(() => {
    const hour = new Date().getHours();
    setHello(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return (
    <h1 className="font-display text-[1.85rem] leading-tight text-balance sm:text-4xl" data-testid="greeting">
      {hello} — here&apos;s the week ahead at {farm}
    </h1>
  );
}

/** Owner-supplied line drawing. The ink follows the theme colour. */
export function BotanicalBanner({ className }: { className?: string }) {
  return (
    <div className={`flex items-center px-3 py-4 sm:px-5 ${className ?? ""}`}>
      <div
        role="img"
        aria-label="Wheat, beetroot, oat, carrot, turnip and a flowering plant, with their roots below the soil line."
        data-testid="botanical-banner"
        className="banner-art w-full"
        style={{ aspectRatio: "2323 / 819" }}
      />
    </div>
  );
}
