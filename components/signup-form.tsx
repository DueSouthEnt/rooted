"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { signUp } from "@/lib/actions";
import type { Section } from "@/lib/sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CARDS: { id: Section; title: string; copy: string; art: string; artClass: string }[] = [
  {
    id: "flowers",
    title: "Flowers",
    copy: "Cut flowers from the last frost to the vase. Sweet peas, dahlias, and the week they need you.",
    art: "/floral-banner.webp",
    artClass: "object-cover object-left-bottom",
  },
  {
    id: "veg",
    title: "Veg",
    copy: "Vegetables from seed to harvest. The beds are on their way. You can claim the section now.",
    art: "/veg-banner.webp",
    artClass: "object-contain object-bottom",
  },
];

export function SignupForm({ heading = "Choose what you'll grow" }: { heading?: string }) {
  const [state, action, pending] = useActionState(signUp, {});
  const [selected, setSelected] = useState<Section[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  function toggle(section: Section) {
    setSelected((current) => (current.includes(section) ? current.filter((item) => item !== section) : [...current, section]));
  }

  return (
    <form action={action} className="space-y-6" data-testid="signup-form" data-hydrated={ready ? "true" : "false"}>
      <div>
        <h2 className="font-heading text-3xl sm:text-4xl">{heading}</h2>
        <p className="mt-2 text-muted-foreground">Pick flowers, vegetables, or both. You can add the other one later.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => {
          const on = selected.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              data-testid={`section-${card.id}`}
              aria-pressed={on}
              onClick={() => toggle(card.id)}
              className={
                on
                  ? "overflow-hidden rounded-[1.4rem] border-2 border-primary bg-card text-left shadow-[0_16px_40px_-28px_rgba(63,92,73,0.7)]"
                  : "overflow-hidden rounded-[1.4rem] border border-border bg-card/80 text-left hover:border-[#c4a574]"
              }
            >
              <div className="flex h-32 items-end bg-[#f3eadc] sm:h-40">
                {/* Decorative line art. The button name is the accessible label. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.art} alt="" className={`h-full w-full ${card.artClass}`} />
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-heading text-2xl">{card.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.copy}</p>
                </div>
                <span
                  className={
                    on
                      ? "mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs text-primary-foreground"
                      : "mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-border text-xs text-muted-foreground"
                  }
                  aria-hidden
                >
                  {on ? "✓" : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {selected.map((section) => (
        <input key={section} type="hidden" name="sections" value={section} />
      ))}
      <div className="grid gap-4 rounded-[1.4rem] border border-border bg-card/90 p-4 sm:p-5">
        <label className="block text-sm">
          Your name
          <Input name="displayName" autoComplete="name" className="mt-1 h-11" placeholder="Optional" />
        </label>
        <label className="block text-sm">
          Email
          <Input name="email" type="email" required autoComplete="email" className="mt-1 h-11" />
        </label>
        <label className="block text-sm">
          Password
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1 h-11" />
        </label>
        {state.error ? (
          <p className="text-sm text-destructive" data-testid="signup-error">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="h-12 w-full text-base" disabled={pending || selected.length === 0}>
          {pending ? "Creating…" : "Create account"}
        </Button>
        <p className="text-center text-sm">
          Already growing with us?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </div>
    </form>
  );
}
