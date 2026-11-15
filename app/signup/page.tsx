"use client";

import Link from "next/link";
import { useActionState } from "react";
import { APP_NAME } from "@/lib/brand";
import { signUp } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, {});
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="font-heading text-3xl">
        {APP_NAME}
      </Link>
      <h1 className="mt-6 font-heading text-4xl">Start a farm plan.</h1>
      <p className="mt-2 text-muted-foreground">A balcony tub counts. So does an allotment, and so does a field.</p>
      <form action={action} className="mt-6 space-y-4">
        <label className="block text-sm">
          Your name
          <Input name="displayName" autoComplete="name" className="mt-1 h-11" placeholder="Graeme" />
        </label>
        <label className="block text-sm">
          Email
          <Input name="email" type="email" required autoComplete="email" className="mt-1 h-11" />
        </label>
        <label className="block text-sm">
          Password
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1 h-11" />
        </label>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state.message ? <p className="text-sm">{state.message}</p> : null}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Already sowing?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
