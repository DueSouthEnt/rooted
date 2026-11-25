import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gateRequest, isPublicPath, requestOrigin } from "@/lib/access";
import { homeForSections, normalizeSections, safeNext, sectionAllowed, sectionsFromForm } from "@/lib/sections";

describe("enabled sections", () => {
  it("keeps flowers and veg, drops junk, and removes duplicates", () => {
    expect(normalizeSections(["veg", "flowers", "veg", "trees"])).toEqual(["flowers", "veg"]);
    expect(normalizeSections("veg, flowers")).toEqual(["flowers", "veg"]);
    expect(normalizeSections(["potatoes"])).toEqual([]);
    expect(normalizeSections(null)).toEqual([]);
  });

  it("reads the sign-up form and refuses an empty choice", () => {
    expect(sectionsFromForm(["veg"])).toEqual(["veg"]);
    expect(sectionsFromForm([])).toEqual([]);
  });

  it("sends a grower to the section they turned on", () => {
    expect(homeForSections(["veg"])).toBe("/veg");
    expect(homeForSections(["flowers", "veg"])).toBe("/flowers");
    expect(homeForSections([])).toBe("/flowers");
  });

  it("blocks a section that was not chosen", () => {
    expect(sectionAllowed(["flowers"], "veg")).toBe(false);
    expect(sectionAllowed(["flowers"], "flowers")).toBe(true);
    expect(sectionAllowed(["flowers", "veg"], "veg")).toBe(true);
  });

  it("only follows a next path the account is allowed to open", () => {
    expect(safeNext("/flowers/farms/new", ["flowers"])).toBe("/flowers/farms/new");
    expect(safeNext("/app/farms/new", ["flowers"])).toBe("/flowers/farms/new");
    expect(safeNext("/veg", ["flowers"])).toBe("/flowers");
    expect(safeNext("/flowers", ["veg"])).toBe("/veg");
    expect(safeNext("https://evil.example", ["flowers"])).toBe("/flowers");
    expect(safeNext("//evil.example", ["flowers"])).toBe("/flowers");
    expect(safeNext("/settings", ["veg"])).toBe("/settings");
  });

  it("stores the choice on profiles and defaults existing growers to flowers", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20261125190000_enabled_sections.sql", import.meta.url), "utf8");
    expect(sql).toContain("enabled_sections text[] not null default array['flowers']::text[]");
    expect(sql).toContain("where value in ('flowers', 'veg')");
    expect(sql).toContain("array['flowers']::text[]");
    expect(sql).toContain("public.handle_new_user()");
  });
});

describe("sign-up gate", () => {
  it("leaves the landing, login, sign-up, confirm, and callback public", () => {
    for (const path of ["/", "/login", "/signup", "/signup/confirm", "/auth/callback", "/auth/confirm"]) {
      expect(isPublicPath(path)).toBe(true);
      expect(gateRequest(path, false)).toBe("allow");
    }
  });

  it("sends a visitor without a session to log in, and answers APIs with a refusal", () => {
    expect(gateRequest("/flowers", false)).toBe("login");
    expect(gateRequest("/flowers/farms/new", false)).toBe("login");
    expect(gateRequest("/veg", false)).toBe("login");
    expect(gateRequest("/settings", false)).toBe("login");
    expect(gateRequest("/app", false)).toBe("login");
    expect(gateRequest("/api/places", false)).toBe("api");
  });

  it("keeps redirects on the browser host when dev is bound to every interface", () => {
    const origin = requestOrigin({
      headers: { get: (name) => (name === "host" ? "localhost:43123" : null) },
      nextUrl: { protocol: "http:", origin: "http://0.0.0.0:43123" },
    });
    expect(origin).toBe("http://localhost:43123");
  });

  it("lets a signed-in grower through", () => {
    expect(gateRequest("/flowers", true)).toBe("allow");
    expect(gateRequest("/veg", true)).toBe("allow");
    expect(gateRequest("/settings", true)).toBe("allow");
  });
});
