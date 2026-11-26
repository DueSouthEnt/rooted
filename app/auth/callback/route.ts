import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/lib/access";
import { normalizeSections, safeNext } from "@/lib/sections";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const code = url.searchParams.get("code");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey || !code) {
    return NextResponse.redirect(new URL("/login?error=confirm", origin));
  }

  const pending: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[] = [];
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => pending.push(cookie));
      },
    },
  });

  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error || !exchanged.data.user) {
    return NextResponse.redirect(new URL("/login?error=confirm", origin));
  }

  const { data } = await supabase.from("profiles").select("enabled_sections").eq("id", exchanged.data.user.id).maybeSingle();
  const sections = normalizeSections(data?.enabled_sections);
  const destination = safeNext(url.searchParams.get("next") ?? "", sections.length ? sections : ["flowers"]);
  const forwarded = NextResponse.redirect(new URL(destination, origin));
  pending.forEach(({ name, value, options }) => {
    forwarded.cookies.set(name, value, options);
  });
  return forwarded;
}
