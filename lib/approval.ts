/** Where a signed-in person may go, based on approval and admin flags. */
export function approvalDestination(
  pathname: string,
  profile: { approved: boolean; isAdmin: boolean },
): "allow" | "waiting" | "home" {
  const path = pathname.split("?")[0] || "/";
  const app =
    path === "/flowers" ||
    path.startsWith("/flowers/") ||
    path === "/veg" ||
    path.startsWith("/veg/") ||
    path === "/settings" ||
    path.startsWith("/settings/");
  const admin = path === "/admin" || path.startsWith("/admin/");
  if (!profile.approved) {
    if (path === "/waiting" || path.startsWith("/auth/")) return "allow";
    if (app || admin) return "waiting";
    return "allow";
  }
  if (path === "/waiting") return "home";
  if (admin && !profile.isAdmin) return "home";
  return "allow";
}

/** A signed-in person cannot grant themselves approval or admin. */
export function keepProfileFlags<T extends { approved: boolean; isAdmin: boolean }>(
  previous: T,
  next: T,
  actor: { isAdmin: boolean; isServiceRole: boolean },
): T {
  const result = { ...next };
  if (!actor.isServiceRole) result.isAdmin = previous.isAdmin;
  if (!actor.isAdmin && !actor.isServiceRole) result.approved = previous.approved;
  return result;
}
