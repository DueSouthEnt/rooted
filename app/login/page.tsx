"use client";

import Link from "next/link";
import { useActionState } from "react";
import { APP_NAME } from "@/lib/brand";
import { signIn } from "@/lib/actions";
import { FloralBanner } from "@/components/floral-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <div className="min-h-full">
      <FloralBanner />
      <main className="mx-auto flex max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="font-heading text-3xl">
        {APP_NAME}
      </Link>
      <h1 className="mt-6 font-heading text-4xl">Welcome back.</h1>
      <p className="mt-2 text-muted-foreground">Your frost date didn't move, even if the week did.</p>
      <form action={action} className="mt-6 space-y-4">
        <label className="block text-sm">
          Email
          <Input name="email" type="email" required autoComplete="email" className="mt-1 h-11" />
        </label>
        <label className="block text-sm">
          Password
          <Input name="password" type="password" required autoComplete="current-password" className="mt-1 h-11" />
        </label>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Checking…" : "Log in"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        No account yet?{" "}
        <Link href="/signup" className="underline">
          Start one
        </Link>
      </p>
      </main>
    </div>
  );
}
