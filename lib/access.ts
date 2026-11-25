/** The host the browser used. Dev binds 0.0.0.0, which must not become the redirect origin or the session cookie is left behind. */
export function requestOrigin(request: { headers: { get(name: string): string | null }; nextUrl: { protocol: string; origin: string } }): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  if (host && !host.startsWith("0.0.0.0")) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

const PUBLIC_EXACT = new Set(["/", "/login", "/signup"]);

const PUBLIC_PREFIXES = ["/signup/confirm", "/auth/callback", "/auth/confirm"];

export function isPublicPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export type Gate = "allow" | "login" | "api";

/** Visitors without a session may only see the landing, login, sign-up, confirm, and auth callback. */
export function gateRequest(pathname: string, hasSession: boolean): Gate {
  if (isPublicPath(pathname) || hasSession) return "allow";
  if (pathname.startsWith("/api/")) return "api";
  return "login";
}
