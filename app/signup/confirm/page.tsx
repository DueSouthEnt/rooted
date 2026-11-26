import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { resendConfirmation } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const email = params.email?.trim() ?? "";
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-16" data-testid="check-inbox">
      <Link href="/" className="wordmark flex items-center gap-2 text-foreground">
        <BrandMark className="size-10 text-[#3f5c49]" />
        {APP_NAME}
      </Link>
      <p className="mt-8 text-sm tracking-[0.16em] text-muted-foreground uppercase">Almost there</p>
      <h1 className="font-heading mt-2 text-4xl sm:text-5xl">Check your inbox</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#4a433c]">
        {email ? (
          <>
            We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it on this
            device and you'll land in your garden.
          </>
        ) : (
          "We sent a confirmation link. Open it on this device and you'll land in your garden."
        )}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        It can take a minute. Check the junk folder if the bed looks empty. The link expires, and you can ask for another.
      </p>
      {params.sent === "1" ? <p className="mt-4 text-sm">Another link is on its way.</p> : null}
      <form action={resendConfirmation} className="mt-6 space-y-3">
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue={email}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3"
          />
        </label>
        <Button type="submit" variant="outline" className="h-11 bg-card">
          Send the link again
        </Button>
      </form>
      <p className="mt-6 text-sm">
        Already confirmed?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
