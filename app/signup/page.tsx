import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-6 sm:px-6">
        <Link href="/" className="wordmark flex items-center gap-2 text-foreground">
          <BrandMark className="size-9 text-[#3f5c49]" />
          {APP_NAME}
        </Link>
        <Link href="/login" className="text-sm underline decoration-[#e4d5c8] underline-offset-4">
          Log in
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <SignupForm heading="Start a garden plan" />
      </main>
    </div>
  );
}
