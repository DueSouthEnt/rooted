"use client";

import { Button } from "@/components/veg/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card px-6 py-8">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Sprout Logic</p>
      <h1 className="mt-2 font-display text-3xl">This page needs another pass.</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        The garden book hit a snag while reading the local database. Try the page again.
      </p>
      <Button className="mt-5" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
