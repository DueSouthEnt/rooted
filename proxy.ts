import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { approvalDestination } from "@/lib/approval";
import { gateRequest, requestOrigin } from "@/lib/access";
import { homeForSections, normalizeSections } from "@/lib/sections";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  if (!url || !key) {
    if (gateRequest(pathname, false) === "allow") return response;
    return NextResponse.redirect(new URL("/login", requestOrigin(request)));
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("approved, is_admin, enabled_sections")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && typeof profile.approved === "boolean") {
      const decision = approvalDestination(pathname, { approved: profile.approved, isAdmin: profile.is_admin === true });
      if (decision !== "allow") {
        const target = decision === "waiting" ? "/waiting" : homeForSections(normalizeSections(profile.enabled_sections));
        const sent = NextResponse.redirect(new URL(target, requestOrigin(request)));
        response.cookies.getAll().forEach((cookie) => sent.cookies.set(cookie));
        return sent;
      }
    }
  }
  const gate = gateRequest(pathname, Boolean(data.user));
  if (gate === "allow") return response;

  if (gate === "api") {
    const denied = NextResponse.json({ error: "Sign in required." }, { status: 401 });
    response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
    return denied;
  }

  const login = new URL("/login", requestOrigin(request));
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  const redirect = NextResponse.redirect(login);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
