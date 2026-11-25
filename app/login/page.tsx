import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  return (
    <Suspense>
      <LoginGate searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginGate({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const notice =
    params.error === "confirm"
      ? "That confirmation link didn't land. Log in if you already confirmed, or start again from the sign-up page."
      : "";
  return <LoginForm next={params.next ?? ""} notice={notice} />;
}
