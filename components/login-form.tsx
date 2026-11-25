"use client";

import Link from "next/link";
import { useActionState } from "react";
import { APP_NAME } from "@/lib/brand";
import { signIn } from "@/lib/actions";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next = "", notice = "" }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  const confirm = state.confirmEmail;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-12">
      <Link href="/" className="wordmark flex items-center gap-2 text-foreground">
        <BrandMark className="size-9 text-[#3f5c49]" />
        {APP_NAME}
      </Link>
      <h1 className="mt-8 font-heading text-4xl">Welcome back.</h1>
      <p className="mt-2 text-muted-foreground">The frost date didn't move, even if the week did.</p>
      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm">
          Email
          <Input name="email" type="email" required autoComplete="email" className="mt-1 h-11" defaultValue={confirm ?? ""} />
        </label>
        <label className="block text-sm">
          Password
          <Input name="password" type="password" required autoComplete="current-password" className="mt-1 h-11" />
        </label>
        {notice ? <p className="text-sm">{notice}</p> : null}
        {state.error ? (
          <p className="text-sm text-destructive" data-testid="login-error">
            {state.error}{" "}
            {confirm ? (
              <Link className="underline" href={`/signup/confirm?email=${encodeURIComponent(confirm)}`}>
                Send the link again
              </Link>
            ) : null}
          </p>
        ) : null}
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
  );
}
