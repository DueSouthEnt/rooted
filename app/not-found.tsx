import Link from "next/link";
import { FloralBanner } from "@/components/floral-banner";

export default function NotFound() {
  return (
    <div className="min-h-full">
      <FloralBanner />
      <main className="mx-auto flex max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-heading text-4xl">This bed isn’t planted</h1>
      <p className="mt-2 text-sm text-muted-foreground">That page isn’t here. The frost dates are still where you left them.</p>
      <Link href="/" className="mt-4 underline">
        Back to Rooted
      </Link>
      </main>
    </div>
  );
}
