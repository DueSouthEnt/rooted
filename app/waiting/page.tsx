import { redirect } from "next/navigation";
import { signOut } from "@/lib/actions";
import { APP_NAME } from "@/lib/brand";
import { homeForSections } from "@/lib/sections";
import { loadProfile } from "@/lib/records";

export default async function WaitingPage() {
  const profile = await loadProfile();
  if (profile.approved) redirect(homeForSections(profile.enabledSections));
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-16" data-testid="waiting">
      <p className="text-sm tracking-[0.16em] text-muted-foreground uppercase">{APP_NAME}</p>
      <h1 className="font-heading mt-3 text-4xl">Thanks, your account is waiting for approval</h1>
      <p className="mt-4 text-lg leading-relaxed text-[#4a433c]">
        Your email is confirmed. Graeme will let you in once he has seen the new account. You can sign out and come back later.
      </p>
      <form action={signOut} className="mt-8">
        <button type="submit" className="h-11 rounded-full bg-primary px-5 text-sm text-primary-foreground">
          Sign out
        </button>
      </form>
    </main>
  );
}
