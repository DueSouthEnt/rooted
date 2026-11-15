import Link from "next/link";
import { BloomMark } from "@/components/floral";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <BloomMark bloom="poppy" className="h-20 w-28" />
      <h1 className="font-heading mt-2 text-4xl">This bed isn’t planted</h1>
      <p className="mt-2 text-sm text-muted-foreground">That page isn’t here. The frost dates are still where you left them.</p>
      <Link href="/" className="mt-4 underline">
        Back to Rooted
      </Link>
    </main>
  );
}
